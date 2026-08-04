import { log } from "/deps.ts";
import {
  ClientMessage,
  CreateRoomRequest,
  Filter,
  JoinRoomRequest,
  Match,
  Media,
  Rate,
  RoomOption,
  RoomSort,
  User,
  UserProgress,
} from "/types/moviematch.ts";
import { memo } from "/internal/app/moviematch/util/memo.ts";
import { Client } from "/internal/app/moviematch/client.ts";
import type { RouteContext } from "./types.ts";

export class RoomExistsError extends Error {
  override name = "RoomExistsError";
}
export class AccessDeniedError extends Error {
  override name = "AccessDeniedError";
}
export class RoomNotFoundError extends Error {
  override name = "RoomNotFoundError";
}
export class UserAlreadyJoinedError extends Error {
  override name = "UserAlreadyJoinedError";
}
export class NoMediaError extends Error {
  override name = "NoMediaError";
}

// How long an empty room (last user gone, nobody signed out) is kept alive
// before it's reaped — rooms otherwise live in memory forever, since there's
// no other cleanup or persistence.
const ROOM_REAP_DELAY_MS = 90 * 60 * 1000;

export class Room {
  RouteContext: RouteContext;
  roomName: string;
  password?: string;
  users = new Map<string, Client>();
  // Unique room key -> base (display) name, so two people sharing a name keep
  // distinct keys internally while the UI shows the same name. Kept after a user
  // leaves so historical match likers still resolve to a name.
  displayNames = new Map<string, string>();
  // resumeToken -> unique userName, so a client whose connection drops (phone
  // locked/backgrounded) can present the token it was issued and reclaim its
  // original identity instead of being handed a fresh one by uniqueUserName.
  resumeTokens = new Map<string, string>();
  // Pending reap timer while this room has zero connected users; see
  // scheduleReap/cancelReap.
  private reapTimer: ReturnType<typeof setTimeout> | null = null;
  filters?: Filter[];
  options?: RoomOption[];
  sort: RoomSort;
  minAge?: number;
  maxAge?: number;
  includeUnrated: boolean;

  media: Promise<Map</*mediaId */ string, Media>>;
  userProgress = new Map</* userName */ string, number>();
  ratings = new Map<
    /* mediaId */ string,
    Array<[userName: string, rating: Rate["rating"], time: number]>
  >();

  constructor(req: CreateRoomRequest, ctx: RouteContext) {
    this.RouteContext = ctx;
    this.roomName = req.roomName;
    this.password = req.password;
    this.options = req.options;
    this.filters = req.filters;
    this.sort = req.sort ?? "random";
    this.minAge = req.minAge;
    this.maxAge = req.maxAge;
    this.includeUnrated = req.includeUnrated ?? false;

    this.media = this.getMedia();
  }

  getMedia = memo(async () => {
    const media: Media[] = [];

    for (const provider of this.RouteContext.providers) {
      media.push(
        ...await provider.getMedia({
          filters: this.filters,
          minAge: this.minAge,
          maxAge: this.maxAge,
          includeUnrated: this.includeUnrated,
        }),
      );
    }

    if (media.length === 0) {
      throw new NoMediaError(
        "There are no items with the specified filters applied.",
      );
    }

    media.sort(() => 0.5 - Math.random());

    return new Map<string, Media>(
      media.map((media) => [media.id, media]),
    );
  });

  // Pick a unique room key for a base name: "John", then "John2", "John3", …
  // Checks both live members and past keys so a returning name can't collide with
  // a prior member's ratings.
  uniqueUserName = (base: string): string => {
    const taken = (name: string) =>
      this.users.has(name) || this.displayNames.has(name);
    if (!taken(base)) return base;
    let n = 2;
    while (taken(`${base}${n}`)) n++;
    return `${base}${n}`;
  };

  // Resolves a connecting client's identity in the room. If `resumeToken`
  // still points at a userName that isn't currently connected (their old
  // socket dropped — phone locked/backgrounded, not an explicit leave), they
  // resume that exact identity: same ratings, same progress, same
  // displayName, so they pick up where they left off instead of casting a
  // second vote under a fresh "name2". Otherwise a new unique name/token pair
  // is issued and remembered for next time.
  claimIdentity = (
    baseName: string,
    resumeToken?: string,
  ): { userName: string; resumeToken: string } => {
    if (resumeToken) {
      const resumedUserName = this.resumeTokens.get(resumeToken);
      if (resumedUserName && !this.users.has(resumedUserName)) {
        return { userName: resumedUserName, resumeToken };
      }
    }
    const userName = this.uniqueUserName(baseName);
    const newResumeToken = crypto.randomUUID();
    this.resumeTokens.set(newResumeToken, userName);
    return { userName, resumeToken: newResumeToken };
  };

  // Starts the countdown to delete this room once it has no connected users
  // — e.g. everyone finished picking and just closed the tab without
  // explicitly leaving. Call whenever `users` might have just hit zero;
  // safe to call repeatedly (each call restarts the countdown).
  scheduleReap = () => {
    this.cancelReap();
    this.reapTimer = setTimeout(() => {
      // Someone may have (re)joined between this firing and being scheduled;
      // only reap if the room is still actually empty.
      if (this.users.size === 0) {
        rooms.delete(this.roomName);
        log.info(
          `Reaped room ${this.roomName}: empty for ${ROOM_REAP_DELAY_MS / 60_000} minutes.`,
        );
      }
    }, ROOM_REAP_DELAY_MS);
  };

  // Cancels a pending reap — call whenever a user (re)joins, since the room
  // is no longer empty.
  cancelReap = () => {
    if (this.reapTimer !== null) {
      clearTimeout(this.reapTimer);
      this.reapTimer = null;
    }
  };

  // Map internal unique keys back to base display names (numbers hidden).
  toDisplayNames = (keys: string[]): string[] =>
    keys.map((key) => this.displayNames.get(key) ?? key);

  getMediaForUser = async (userName: string): Promise<Media[]> => {
    const media = await this.media;
    return [...media.values()].filter((media) => {
      const ratings = this.ratings.get(media.id);
      return !ratings || !ratings.find(([_userName]) => userName === _userName);
    });
  };

  storeRating = async (userName: string, rating: Rate, matchedAt: number) => {
    const existingRatings = this.ratings.get(rating.mediaId);
    const progress = (this.userProgress.get(userName) ?? 0) + 1;
    if (existingRatings) {
      const existingRatingByUser = existingRatings.find(([_userName]) =>
        _userName === userName
      );

      if (existingRatingByUser) {
        log.warning(`${userName} has already rated ${rating.mediaId}.`);
        return;
      }

      existingRatings.push([userName, rating.rating, matchedAt]);
      const likes = existingRatings.filter(([, rating]) => rating === "like");
      if (likes.length > 1) {
        const media = (await this.media).get(rating.mediaId);
        if (media) {
          this.notifyMatch({
            matchedAt,
            media,
            users: this.toDisplayNames(likes.map(([userName]) => userName)),
          });
        }
      }
    } else {
      this.ratings.set(rating.mediaId, [[userName, rating.rating, matchedAt]]);
    }

    this.userProgress.set(userName, progress);

    this.notifyProgress({ userName }, progress / (await this.media).size);
  };

  // Undoes storeRating for a single user/media pair (e.g. the user swiped the
  // wrong direction). If their "like" was the second one that had formed a
  // match, the match is retracted for everyone via notifyUnmatch.
  removeRating = async (userName: string, mediaId: string) => {
    const existingRatings = this.ratings.get(mediaId);
    if (!existingRatings) {
      return;
    }

    const hadMatch =
      existingRatings.filter(([, rating]) => rating === "like").length > 1;

    const remainingRatings = existingRatings.filter(([_userName]) =>
      _userName !== userName
    );

    if (remainingRatings.length === 0) {
      this.ratings.delete(mediaId);
    } else {
      this.ratings.set(mediaId, remainingRatings);
    }

    const stillMatched =
      remainingRatings.filter(([, rating]) => rating === "like").length > 1;
    if (hadMatch && !stillMatched) {
      this.notifyUnmatch(mediaId);
    }

    const progress = Math.max(
      (this.userProgress.get(userName) ?? 0) - 1,
      0,
    );
    this.userProgress.set(userName, progress);

    this.notifyProgress({ userName }, progress / (await this.media).size);
  };

  getMatches = async (
    userName: string,
    allLikes: boolean,
  ): Promise<Match[]> => {
    const matches: Match[] = [];

    for (const [mediaId, rating] of this.ratings.entries()) {
      const likes = rating.filter(([, rating]) => rating === "like");
      const matchedAt = likes.reduce(
        (lastTime, [, , time]) => (time > lastTime ? time : lastTime),
        0,
      );
      if (
        likes.length > 1 &&
        (allLikes || !!likes.find(([_userName]) => userName === _userName))
      ) {
        const media = (await this.media).get(mediaId);
        if (media) {
          matches.push({
            matchedAt,
            media,
            users: this.toDisplayNames(likes.map(([userName]) => userName)),
          });
        } else {
          log.info(
            `Tried to rate mediaId: ${mediaId}, but it looks like that media item doesn't exist.`,
          );
        }
      }
    }

    return matches;
  };

  getUsers = async (): Promise<Array<{ user: User; progress: number }>> => {
    const mediaSize = (await this.media).size;
    return [...this.users.values()].map((client) => {
      const user = client.getUser();
      return {
        user,
        progress: (this.userProgress.get(user.userName) ?? 0) / mediaSize,
      };
    });
  };

  notifyJoin = (userProgress: UserProgress) => {
    this.broadcastMessage({
      type: "userJoinedRoom",
      payload: userProgress,
    }, userProgress.user.userName);
  };

  notifyLeave = (user: User) => {
    this.broadcastMessage({
      type: "userLeftRoom",
      payload: user,
    }, user.userName);
  };

  notifyProgress = (user: User, progress: number) => {
    this.broadcastMessage({
      type: "userProgress",
      payload: { user, progress },
    });
  };

  notifyMatch = (match: Match) => {
    this.broadcastMessage({
      type: "match",
      payload: match,
    });
  };

  notifyUnmatch = (mediaId: string) => {
    this.broadcastMessage({
      type: "unmatch",
      payload: { mediaId },
    });
  };

  broadcastMessage = (msg: ClientMessage, sourceUserName?: string) => {
    for (const [userName, client] of this.users.entries()) {
      if (client && userName !== sourceUserName) {
        client.sendMessage(msg);
      }
    }
  };
}

type RoomName = string;

const rooms = new Map<RoomName, Room>();

export const createRoom = async (
  createRequest: CreateRoomRequest,
  ctx: RouteContext,
): Promise<Room> => {
  if (rooms.has(createRequest.roomName)) {
    throw new RoomExistsError(`${createRequest.roomName} already exists.`);
  }

  const room = new Room(createRequest, ctx);
  await room.media;
  rooms.set(room.roomName, room);
  return room;
};

export const getRoom = (
  { roomName, password }: JoinRoomRequest,
): Room => {
  const room = rooms.get(roomName);

  if (!room) {
    throw new RoomNotFoundError(`${roomName} does not exist`);
  }

  if (typeof room.password === "string") {
    if (room.password === password) {
      return room;
    } else {
      throw new AccessDeniedError(`${roomName} requires a password`);
    }
  }

  // No same-name rejection: duplicate names are made unique on join (see
  // Room.uniqueUserName), so two people sharing a name can both be in the room.
  return room;
};

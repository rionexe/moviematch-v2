// Persists the per-room resume token issued by the server on join/create, so
// a dropped connection (phone locked/backgrounded) can present it on the next
// joinRoom and resume the same identity instead of starting over. See
// JoinRoomRequest.resumeToken / JoinRoomSuccess.resumeToken.

const keyFor = (roomName: string) => `mm-resume-token:${roomName.toUpperCase()}`;

export const getResumeToken = (roomName: string): string | undefined => {
  try {
    return localStorage.getItem(keyFor(roomName)) ?? undefined;
  } catch {
    return undefined;
  }
};

export const setResumeToken = (roomName: string, token: string) => {
  try {
    localStorage.setItem(keyFor(roomName), token);
  } catch {
    // localStorage unavailable — resuming just won't work next time.
  }
};

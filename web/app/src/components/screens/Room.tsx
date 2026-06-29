import React, { useRef, useState } from "react";
import { ErrorMessage } from "../atoms/ErrorMessage";
import { Tr } from "../atoms/Tr";
import {
  SegmentedControlOption,
  SegmentedControls,
} from "../atoms/SegmentedControls";
import { Version } from "../atoms/Version";
import { Layout } from "../layout/Layout";
import { Card } from "../molecules/Card";
import { CardStack } from "../organisms/CardStack";
import { MatchesList } from "../organisms/MatchesList";
import { RoomInfoBar } from "../organisms/RoomInfoBar";

import styles from "./Room.module.css";
import { useStore } from "../../store";

export const RoomScreen = () => {
  const [{ room }, dispatch] = useStore(["room"]);
  const matchesEl = useRef<HTMLUListElement>(null);
  const [matchOrder, setMatchOrder] = useState<string>("all");
  const [media] = useState(room?.media);
  const [ratedCount, setRatedCount] = useState(0);

  if (!room || !media) {
    return <ErrorMessage message="No Room!" />;
  }

  return (
    <Layout hideLogo className={styles.screen}>
      <CardStack
        cards={media}
        onCardDismissed={(card, rating) => {
          dispatch({
            type: "rate",
            payload: {
              mediaId: card.id,
              rating: rating === "left" ? "dislike" : "like",
            },
          });
          setRatedCount((n) => n + 1);
        }}
        renderCard={(card) => <Card media={card} key={card.id} />}
      />

      <RoomInfoBar />
      <SegmentedControls
        name="sortMatches"
        value={matchOrder}
        onChange={(value) => {
          if (matchesEl.current) {
            matchesEl.current.scrollTo({ left: 0, behavior: "smooth" });
          }
          setMatchOrder(value);
        }}
        paddingTop="s4"
      >
        <SegmentedControlOption value="all">
          All
        </SegmentedControlOption>
        <SegmentedControlOption value="mostLiked">
          Most Liked
        </SegmentedControlOption>
      </SegmentedControls>
      <MatchesList ref={matchesEl} ratedCount={ratedCount}>
        {room.matches &&
          (() => {
            const byAge = [...room.matches].sort(
              (a, b) => a.matchedAt - b.matchedAt,
            );
            const list =
              matchOrder === "mostLiked"
                ? (() => {
                    const max = Math.max(...byAge.map((m) => m.users.length));
                    return byAge.filter((m) => m.users.length === max);
                  })()
                : byAge;
            return list.map((match) => (
              <Card
                media={match.media}
                key={match.media.id}
                title={
                  <Tr
                    name="MATCHES_SECTION_CARD_LIKERS"
                    context={{
                      users: match.users.join(" & "),
                      movie: match.media.title,
                    }}
                  />
                }
              />
            ));
          })()}
      </MatchesList>
      <Version />
    </Layout>
  );
};

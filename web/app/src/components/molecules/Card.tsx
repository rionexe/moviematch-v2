import React, { forwardRef, ReactNode, useState } from "react";
import type { Media } from "../../../../../types/moviematch";

import { ContentRatingSymbol } from "../icons/ContentRatingSymbol";
import { StarIcon } from "../icons/StarIcon";
import { Pill } from "../atoms/Pill";

import styles from "./Card.module.css";
import { ShareIcon } from "../icons/ShareIcon";

export interface CardProps {
  title?: ReactNode;
  media: Media;

  style?: React.CSSProperties;
}

const formatTime = (milliseconds: number) =>
  `${Math.round(milliseconds / 1000 / 60)} minutes`;

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ media, title }, ref) => {
    const [showMoreInfo, setShowMoreInfo] = useState<boolean>(false);

    const { rootPath } = document.body.dataset;

    const srcSet = [
      `${rootPath}${media.posterUrl}?width=300`,
      `${rootPath}${media.posterUrl}?width=450 1.5x`,
      `${rootPath}${media.posterUrl}?width=600 2x`,
      `${rootPath}${media.posterUrl}?width=900 3x`,
    ];

    const mediaTitle = `${media.title}${
      media.type === "movie" ? ` (${media.year})` : ""
    }`;

    return (
      <div
        ref={ref}
        className={styles.card}
        onClick={() => setShowMoreInfo((v) => !v)}
      >
        <img
          className={styles.poster}
          src={srcSet[0]}
          srcSet={srcSet.join(", ")}
          alt={`${media.title} poster`}
          draggable={false}
        />
        {/* V1-style tap-to-flip: tapping the poster cross-fades this frosted detail
            panel over it. The front is just the poster (no title bar / info button). */}
        {showMoreInfo && (
          <div className={styles.moreInfo}>
            <p className={styles.moreInfoTitle}>{mediaTitle}</p>
            {title && <p className={styles.moreInfoLikers}>{title}</p>}
            <div className={styles.moreInfoMetadata}>
              <Pill>{media.year}</Pill>
              <Pill>{formatTime(+media.duration)}</Pill>
              <Pill>
                <StarIcon height="0.8rem" width="0.5rem" /> {media.rating}
              </Pill>
              {media.contentRating && (
                <Pill>
                  <ContentRatingSymbol
                    rating={media.contentRating}
                    size="1rem"
                  />
                </Pill>
              )}
              {media.genres.map((genre) => <Pill key={genre}>{genre}</Pill>)}
              {/* Stop the click bubbling to the card so opening Plex doesn't flip it back */}
              <span onClick={(e) => e.stopPropagation()}>
                <Pill href={media.linkUrl}>
                  <span>Open in Plex</span>
                  <ShareIcon />
                </Pill>
              </span>
            </div>
            <p className={styles.moreInfoDescription}>
              {media.description}
            </p>
          </div>
        )}
      </div>
    );
  },
);

Card.displayName = "Card";

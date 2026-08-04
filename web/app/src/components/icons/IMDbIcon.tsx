import React from "react";

export const IMDbIcon = ({ size = "2.25rem" }: { size?: string }) => {
  const { rootPath } = document.body.dataset;

  return (
    <img
      src={`${rootPath}/icons/imdb.png`}
      alt="Open on IMDb"
      style={{ width: size, height: size, display: "block" }}
      draggable={false}
    />
  );
};

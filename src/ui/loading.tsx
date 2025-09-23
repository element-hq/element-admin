// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import styles from "./loading.module.css";

export const Loading = () => (
  <svg
    height="800"
    width="800"
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    className={styles["loading"]}
  >
    <defs>
      <mask id="reveal">
        <circle
          className={styles["reveal-circle"]}
          cx="50"
          cy="50"
          r="50"
          fill="white"
        />
      </mask>
    </defs>
    <g className={styles["pulse"]}>
      <circle
        cx="50"
        cy="50"
        r="10"
        fill="rgb(from currentColor r g b / 10%)"
        className={styles["wireframe-fade"]}
      />
      <g>
        <path
          pathLength="100"
          stroke="rgb(from currentColor r g b / 10%)"
          fill="none"
          strokeWidth="1.465"
          d="
            M46.86,51.1
            a4.22,4.22 90 0 0 4.22,4.22
          "
          strokeLinecap="round"
        />
        <path
          pathLength="100"
          stroke="rgb(from currentColor r g b / 10%)"
          fill="none"
          strokeWidth="1.465"
          d="
            M48.9,46.86
            a4.22,4.22 90 0 0 -4.22,4.22
          "
          strokeLinecap="round"
        />
        <path
          pathLength="100"
          stroke="rgb(from currentColor r g b / 10%)"
          fill="none"
          strokeWidth="1.465"
          d="
            M51.1,53.13
            a4.22,4.22 90 0 0 4.22,-4.22
          "
          strokeLinecap="round"
        />
        <path
          pathLength="100"
          stroke="rgb(from currentColor r g b / 10%)"
          fill="none"
          strokeWidth="1.465"
          d="
            M53.13,48.9
            a4.22,4.22 90 0 0 -4.22,-4.22
          "
          strokeLinecap="round"
        />
      </g>

      <g mask="url(#reveal)">
        <circle
          cx="50"
          cy="50"
          r="50"
          fill="rgb(from currentColor r g b / 10%)"
          className={styles["wireframe-fade"]}
        />
        <circle cx="50" cy="50" r="10" fill="#0DBD8B" />
      </g>

      <g className={styles["swirls"]}>
        <path
          pathLength="100"
          stroke="white"
          fill="none"
          strokeWidth="1.465"
          d="
            M46.86,51.1
            a4.22,4.22 90 0 0 4.22,4.22
          "
          strokeLinecap="round"
        />
        <path
          pathLength="100"
          stroke="white"
          fill="none"
          strokeWidth="1.465"
          d="
            M48.9,46.86
            a4.22,4.22 90 0 0 -4.22,4.22
          "
          strokeLinecap="round"
        />
        <path
          pathLength="100"
          stroke="white"
          fill="none"
          strokeWidth="1.465"
          d="
            M51.1,53.13
            a4.22,4.22 90 0 0 4.22,-4.22
          "
          strokeLinecap="round"
        />
        <path
          pathLength="100"
          stroke="white"
          fill="none"
          strokeWidth="1.465"
          d="
            M53.13,48.9
            a4.22,4.22 90 0 0 -4.22,-4.22
          "
          strokeLinecap="round"
        />
      </g>
    </g>
  </svg>
);

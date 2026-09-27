// The diary's four customizable colors, matching the four areas visible on
// the template: the overall background, every border/grid line, the shaded
// "boxes" (header banner, CLASS/SECTION/etc. labels, SUBJECT/DESCRIPTION
// header row), and all of the text. These now live on the School record in
// MongoDB (set from the Admin Portal), not in this browser's localStorage,
// so every device shows the same look for a given school.
export const DEFAULT_COLORS = {
  background: "#0b2545",
  border: "#38bdf8",
  box: "#123a67",
  text: "#f1f5f9",
};
import React from "react";

function makeGlyph(symbol, name) {
  function MysticGlyph({ size = 18, className = "", "aria-hidden": ariaHidden = true, ...rest }) {
    const numericSize = Number(size) || 18;
    const passthrough = { ...rest };
    delete passthrough.strokeWidth;
    delete passthrough.fill;
    delete passthrough.color;
    return (
      <span
        {...passthrough}
        aria-hidden={ariaHidden}
        className={`mystic-icon mystic-icon-${name}${className ? ` ${className}` : ""}`}
        style={{ "--mystic-icon-size": `${numericSize}px` }}
      >
        {symbol}
      </span>
    );
  }
  MysticGlyph.displayName = name;
  return MysticGlyph;
}

function makeChevron(name, direction = "right") {
  function MysticChevron({ size = 18, className = "", "aria-hidden": ariaHidden = true, ...rest }) {
    const numericSize = Number(size) || 18;
    const passthrough = { ...rest };
    delete passthrough.strokeWidth;
    delete passthrough.fill;
    delete passthrough.color;
    return (
      <span
        {...passthrough}
        aria-hidden={ariaHidden}
        className={`mystic-icon mystic-icon-chevron mystic-icon-${name} mystic-icon-chevron-${direction}${className ? ` ${className}` : ""}`}
        style={{ "--mystic-icon-size": `${numericSize}px` }}
      />
    );
  }
  MysticChevron.displayName = name;
  return MysticChevron;
}

export const ArrowRight = makeChevron("arrow-right", "right");
export const ArrowLeft = makeChevron("arrow-left", "left");
export const ArrowUpRight = makeGlyph("↗", "arrow-up-right");
export const ChevronRight = makeChevron("chevron-right", "right");
export const Check = makeGlyph("✦", "check");
export const CheckCircle2 = makeGlyph("✦", "check-circle");
export const Sparkles = makeGlyph("✦", "sparkles");
export const ShieldCheck = makeGlyph("◇", "shield");
export const LockKeyhole = makeGlyph("⊙", "lock");
export const History = makeGlyph("☾", "history");
export const Clock3 = makeGlyph("◷", "clock");
export const CreditCard = makeGlyph("▱", "card");
export const Eye = makeGlyph("◉", "eye");
export const Gem = makeGlyph("◇", "gem");
export const Bookmark = makeGlyph("⌑", "bookmark");
export const RotateCcw = makeGlyph("↺", "rotate");
export const RefreshCw = makeGlyph("↺", "refresh");
export const Share2 = makeGlyph("↗", "share");
export const Shuffle = makeGlyph("⤨", "shuffle");
export const Menu = makeGlyph("⋮", "menu");
export const X = makeGlyph("", "close");
export const Copy = makeGlyph("⧉", "copy");
export const Send = makeGlyph("→", "send");
export const Mail = makeGlyph("✉", "mail");
export const ExternalLink = makeGlyph("↗", "external");
export const KeyRound = makeGlyph("⚿", "key");
export const MessageCircleQuestion = makeGlyph("?", "question");
export const FileText = makeGlyph("▧", "file");
export const BookOpenText = makeGlyph("⌑", "book");
export const Download = makeGlyph("↓", "download");
export const MapPin = makeGlyph("⌖", "pin");
export const UserRound = makeGlyph("☉", "user");
export const Search = makeGlyph("⌕", "search");
export const CalendarDays = makeGlyph("◫", "calendar");

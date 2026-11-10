import Svg, { Circle, Path, Rect } from "react-native-svg";

type P = { size?: number; color?: string };
const S = ({ size = 24, color = "#2b2b2b", children }: P & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

export const Menu = (p: P) => <S {...p}><Path d="M3.5 6h17M3.5 12h11M3.5 18h17" /></S>;
export const NewChat = (p: P) => (
  <S {...p}>
    <Path d="M12 20.5a8.5 8.5 0 1 0-7.6-4.7L3.5 20.5l4.7-.9A8.5 8.5 0 0 0 12 20.5Z" />
    <Path d="M12 8.5v7M8.5 12h7" />
  </S>
);
export const Copy = (p: P) => (
  <S {...p}>
    <Rect x="8" y="8" width="12.5" height="12.5" rx="2.5" />
    <Path d="M16 8V5.5A2 2 0 0 0 14 3.5H5.5a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2H8" />
  </S>
);
export const ThumbUp = (p: P) => (
  <S {...p}>
    <Path d="M7 10.5v10H4.5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1H7Z" />
    <Path d="M7 10.5 11 3a2.5 2.5 0 0 1 2.5 2.8L13 9.5h5.6a2 2 0 0 1 2 2.4l-1.5 7a2 2 0 0 1-2 1.6H7" />
  </S>
);
export const ThumbDown = (p: P) => (
  <S {...p}>
    <Path d="M17 13.5v-10h2.5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H17Z" />
    <Path d="M17 13.5 13 21a2.5 2.5 0 0 1-2.5-2.8l.5-3.7H5.4a2 2 0 0 1-2-2.4l1.5-7a2 2 0 0 1 2-1.6H17" />
  </S>
);
export const Share = (p: P) => <S {...p}><Path d="M14 4.5 20.5 10.5 14 16.5v-3.5c-5 0-8.5 1.5-10.5 6 .5-6 3.5-10 10.5-11V4.5Z" /></S>;
export const Retry = (p: P) => (
  <S {...p}>
    <Path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <Path d="M20 4v4.5h-4.5" />
  </S>
);
export const More = ({ size = 24, color = "#2b2b2b" }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Circle cx="5.5" cy="12" r="1.4" />
    <Circle cx="12" cy="12" r="1.4" />
    <Circle cx="18.5" cy="12" r="1.4" />
  </Svg>
);
export const Plus = (p: P) => <S {...p}><Path d="M12 4.5v15M4.5 12h15" /></S>;
export const Mic = (p: P) => (
  <S {...p}>
    <Rect x="9" y="3" width="6" height="11.5" rx="3" />
    <Path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
  </S>
);
export const ArrowUp = (p: P) => <S {...p}><Path d="M12 19V5M6 11l6-6 6 6" /></S>;
export const ArrowDown = (p: P) => <S {...p}><Path d="M12 5v14M6 13l6 6 6-6" /></S>;
export const Stop = ({ size = 20, color = "#fff" }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Rect x="7" y="7" width="10" height="10" rx="1.5" />
  </Svg>
);
export const Chevron = (p: P) => <S {...p}><Path d="m9 6 6 6-6 6" /></S>;
export const Book = (p: P) => (
  <S {...p}>
    <Path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" />
  </S>
);
export const Photo = (p: P) => (
  <S {...p}>
    <Rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <Circle cx="9" cy="10" r="1.6" />
    <Path d="m20.5 16-5-5-8.5 8" />
  </S>
);
export const Plane = (p: P) => <S {...p}><Path d="M10.5 13.5 3 11l1.5-1.5 7.5.5 4.5-5a2 2 0 0 1 3 3l-5 4.5.5 7.5L13.5 21l-2.5-7.5" /></S>;
export const Cap = (p: P) => (
  <S {...p}>
    <Path d="m2.5 9 9.5-4.5L21.5 9 12 13.5 2.5 9Z" />
    <Path d="M6.5 11v4.5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11M21.5 9v5" />
  </S>
);
export const Store = (p: P) => (
  <S {...p}>
    <Path d="M4 9.5V20h16V9.5M3 9.5 5 4h14l2 5.5a2.5 2.5 0 0 1-4.5 1.5 2.5 2.5 0 0 1-4.5 0 2.5 2.5 0 0 1-4.5 0A2.5 2.5 0 0 1 3 9.5Z" />
    <Path d="M9.5 20v-5h5v5" />
  </S>
);
export const Close = (p: P) => <S {...p}><Path d="M6 6l12 12M18 6 6 18" /></S>;
export const Trash = (p: P) => <S {...p}><Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></S>;
export const Check = (p: P) => <S {...p}><Path d="m5 12.5 4.5 4.5L19 7.5" /></S>;
export const Flag = (p: P) => <S {...p}><Path d="M5 21V4.5M5 4.5h12l-2.5 4 2.5 4H5" /></S>;

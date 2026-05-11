import { useRef } from 'react';
import { View, StyleSheet, PanResponder, ScrollView } from 'react-native';

interface Props {
  scrollRef: React.RefObject<ScrollView>;
  contentHeight: number;
  viewportHeight: number;
  scrollY: number;
}

const TRACK_PAD = 6;
const THUMB_MIN  = 48;

export function ScrollThumb({ scrollRef, contentHeight, viewportHeight, scrollY }: Props) {
  const scrollYRef       = useRef(scrollY);
  scrollYRef.current     = scrollY;

  const scrollRange    = Math.max(1, contentHeight - viewportHeight);
  const trackHeight    = Math.max(1, viewportHeight - TRACK_PAD * 2);
  const thumbHeight    = Math.max(THUMB_MIN, (viewportHeight / Math.max(contentHeight, 1)) * trackHeight);
  const thumbTravel    = Math.max(1, trackHeight - thumbHeight);
  const thumbTop       = TRACK_PAD + (scrollY / scrollRange) * thumbTravel;

  const scrollRangeRef   = useRef(scrollRange);
  scrollRangeRef.current = scrollRange;
  const thumbTravelRef   = useRef(thumbTravel);
  thumbTravelRef.current = thumbTravel;
  const startScrollY     = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        startScrollY.current = scrollYRef.current;
      },
      onPanResponderMove: (_, gs) => {
        const delta = (gs.dy / thumbTravelRef.current) * scrollRangeRef.current;
        const next  = Math.max(0, Math.min(scrollRangeRef.current, startScrollY.current + delta));
        scrollRef.current?.scrollTo({ y: next, animated: false });
      },
    }),
  ).current;

  if (contentHeight <= viewportHeight + 20) return null;

  return (
    <View style={[s.track, { height: viewportHeight }]} pointerEvents="box-none">
      <View
        style={[s.thumb, { height: thumbHeight, top: thumbTop }]}
        {...panResponder.panHandlers}
      />
    </View>
  );
}

const s = StyleSheet.create({
  track: {
    position: 'absolute',
    right: 2,
    top: 0,
    width: 6,
    pointerEvents: 'box-none',
  },
  thumb: {
    position: 'absolute',
    right: 0,
    width: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(148, 163, 184, 0.45)',
  },
});

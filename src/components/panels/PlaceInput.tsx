// Search field for any place: stations (instant, from our own list) plus addresses and points of
// interest (from the server, after a short pause in typing).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { fetchPlaces, stationPlace, type Place, type PlaceResult } from "../../lib/api";
import { searchStations, type Indexed } from "../../lib/search";
import { PlaceGlyph, PlaceIcon } from "../icons";
import { LineChip, Txt } from "../ui";
import { useTheme } from "../../lib/theme";
import { t } from "../../i18n";

type Props = {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
  searchIndex: Indexed[];
  disabled?: boolean;
  trailing?: ReactNode;
  onFocus?: () => void;
  onOpenChange?: (open: boolean) => void;
};

export function PlaceInput({ label, placeholder, value, onChange, searchIndex, disabled, trailing, onFocus, onOpenChange }: Props) {
  const th = useTheme();
  const [text, setText] = useState(value?.name ?? "");
  const [open, setOpenState] = useState(false);
  const [remote, setRemote] = useState<PlaceResult | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const setOpen = (o: boolean) => { setOpenState(o); onOpenChange?.(o); };

  useEffect(() => { setText(value?.name ?? ""); }, [value]);

  const typed = open && text.trim().length >= 3 && text !== value?.name ? text.trim() : "";
  useEffect(() => {
    setRemote(null);
    if (!typed) { setRemoteLoading(false); return; }
    const ctrl = new AbortController();
    setRemoteLoading(true);
    const timer = setTimeout(() => {
      fetchPlaces(typed, ctrl.signal)
        .then(r => { if (!ctrl.signal.aborted) setRemote(r); })
        .catch(() => { if (!ctrl.signal.aborted) setRemote({ source: "none", places: [], note: t("Address search is unavailable right now.") }); })
        .finally(() => { if (!ctrl.signal.aborted) setRemoteLoading(false); });
    }, 300);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [typed]);

  const stations = useMemo(() => (open ? searchStations(searchIndex, text, 5) : []), [open, text, searchIndex]);
  const options = useMemo(() => [
    ...stations.map(s => ({ key: `s${s.i}`, place: stationPlace(s) })),
    ...(remote?.places ?? []).map((p, k) => ({ key: `p${k}`, place: { ...p } as Place })),
  ], [stations, remote]);

  const pick = (p: Place) => { valueRef.current = p; onChange(p); setText(p.name); setOpen(false); Keyboard.dismiss(); };
  const nStations = stations.length;
  const showList = open && text.trim().length > 1 && text !== value?.name;

  return (
    <View>
      <Txt size={12} weight={700} muted style={styles.label}>{label}</Txt>
      <View style={[styles.row, { backgroundColor: th.chipBg, borderColor: open ? th.accent : th.line }]}>
        {value && <View style={styles.glyph}><PlaceGlyph place={value} size={18} color={th.muted} /></View>}
        <BottomSheetTextInput
          style={[styles.input, { color: th.fg }]}
          placeholder={placeholder}
          placeholderTextColor={th.muted}
          editable={!disabled}
          value={text}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          selectTextOnFocus
          onFocus={() => { setOpen(true); onFocus?.(); }}
          onBlur={() => setTimeout(() => { setOpen(false); setText(valueRef.current?.name ?? ""); }, 150)}
          onChangeText={v => { setText(v); setOpen(true); if (!v) { valueRef.current = null; onChange(null); } }}
          onSubmitEditing={() => { if (options[0]) pick(options[0].place); }}
          accessibilityLabel={label}
        />
        {trailing}
      </View>
      {showList && (
        <View style={[styles.list, { backgroundColor: th.panel, borderColor: th.line }]}>
          {options.map((o, k) => (
            <View key={o.key}>
              {k === 0 && nStations > 0 && <Txt size={11} weight={700} muted style={styles.head}>{t("Stations").toUpperCase()}</Txt>}
              {k === nStations && <Txt size={11} weight={700} muted style={styles.head}>{t("Addresses & places").toUpperCase()}</Txt>}
              <Pressable onPress={() => pick(o.place)} style={({ pressed }) => [styles.item, pressed && { backgroundColor: th.chipBg }]} accessibilityRole="button">
                <PlaceGlyph place={o.place} size={20} color={th.muted} />
                <View style={styles.itemText}>
                  <Txt size={15} weight={600} numberOfLines={1}>{o.place.name}</Txt>
                  {o.place.detail ? <Txt size={12} muted numberOfLines={1}>{o.place.detail}</Txt> : null}
                </View>
                {o.place.kind === "station" && (
                  <View style={styles.lines}>
                    {(o.place.lines ?? []).slice(0, 3).map(l => <LineChip key={l} line={l} small />)}
                    {(o.place.lines?.length ?? 0) > 3 && <Txt size={11} muted>+{(o.place.lines?.length ?? 0) - 3}</Txt>}
                  </View>
                )}
              </Pressable>
            </View>
          ))}
          {nStations === options.length && typed ? (
            <Txt size={13} muted style={styles.note}>
              {remoteLoading ? t("Looking up addresses…") : remote?.note ? t(remote.note) : remote && !remote.places.length ? t("No addresses found.") : ""}
            </Txt>
          ) : null}
          {!options.length && !typed && <Txt size={13} muted style={styles.note}>{t("No station matches \"{text}\". Type 3+ letters to search addresses.", { text: text.trim() })}</Txt>}
          {remote?.source === "osm" && remote.places.length > 0 && (
            <View style={[styles.note, styles.osm]}><PlaceIcon kind="address" size={11} color={th.muted} /><Txt size={11} muted>{t("Addresses from OpenStreetMap")}</Txt></View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 4, marginLeft: 2 },
  row: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingLeft: 12, paddingRight: 4, height: 48 },
  glyph: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, fontFamily: "Manrope_600SemiBold", height: 46 },
  list: { marginTop: 6, borderRadius: 12, borderWidth: 1, paddingVertical: 4, overflow: "hidden" },
  head: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2, letterSpacing: 0.5 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  itemText: { flex: 1, minWidth: 0 },
  lines: { flexDirection: "row", alignItems: "center", gap: 3 },
  note: { paddingHorizontal: 12, paddingVertical: 8 },
  osm: { flexDirection: "row", alignItems: "center", gap: 4 },
});

// Expo Go doesn't include the native map (MapLibre), so the real screen only loads in the app's own build.
import Constants, { ExecutionEnvironment } from "expo-constants";
import { StyleSheet, View } from "react-native";
import { Txt } from "../components/ui";

const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export default function Index() {
  if (inExpoGo) {
    return (
      <View style={styles.wrap}>
        <Txt size={22} weight={800} color="#fff">This is Expo Go</Txt>
        <Txt size={15} color="#b9c4cf" style={styles.center}>
          Berlin Live needs its own build because the map is native code. Close Expo Go, then run{"\n"}npx expo run:ios{"\n"}and open the "Berlin Live" app instead.
        </Txt>
      </View>
    );
  }
  const Home = require("../screens/Home").default;
  return <Home />;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#17212B", alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  center: { textAlign: "center" },
});

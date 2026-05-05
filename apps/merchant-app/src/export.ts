import { createBridgeComponent } from "@module-federation/bridge-react/v19";
import App from "./App.tsx";

const BridgeApp = createBridgeComponent({
  rootComponent: App,
});

export const config = {
  platform: "react",
  menu: [],
};

export default BridgeApp;

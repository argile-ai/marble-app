import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from "react";
import type { Asset } from "../types";
import { DEMO_ASSETS } from "../utils/constants";

type Action =
  | { type: "ADD_ASSET"; payload: Asset }
  | { type: "UPDATE_ASSET"; payload: { id: string; updates: Partial<Asset> } }
  | { type: "REMOVE_ASSET"; payload: string };

interface State {
  assets: Asset[];
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_ASSET":
      return { ...state, assets: [action.payload, ...state.assets] };
    case "UPDATE_ASSET":
      return {
        ...state,
        assets: state.assets.map((a) =>
          a.id === action.payload.id ? { ...a, ...action.payload.updates } : a
        ),
      };
    case "REMOVE_ASSET":
      return {
        ...state,
        assets: state.assets.filter((a) => a.id !== action.payload),
      };
    default:
      return state;
  }
}

const AssetContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AssetProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    assets: DEMO_ASSETS,
  });

  return (
    <AssetContext.Provider value={{ state, dispatch }}>
      {children}
    </AssetContext.Provider>
  );
}

export function useAssets() {
  const ctx = useContext(AssetContext);
  if (!ctx) throw new Error("useAssets must be used within AssetProvider");
  return ctx;
}

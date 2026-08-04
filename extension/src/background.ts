type Action = {
  onClicked: {
    addListener(listener: (tab: { windowId?: number }) => void): void;
  };
};

type SidePanel = {
  open(options: { windowId: number }): Promise<void>;
};

export function registerSidePanelAction(action: Action, sidePanel: SidePanel): void {
  action.onClicked.addListener((tab) => {
    if (typeof tab.windowId === "number") {
      void sidePanel.open({ windowId: tab.windowId });
    }
  });
}

declare const chrome:
  | {
      action: Action;
      sidePanel: SidePanel;
    }
  | undefined;

if (typeof chrome !== "undefined") {
  registerSidePanelAction(chrome.action, chrome.sidePanel);
}

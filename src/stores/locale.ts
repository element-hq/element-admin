import { shared } from "use-broadcast-ts";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LocaleStoreState {
  /** The user-selected locale, null if using browser default */
  selectedLocale: string | null;
}

interface LocaleStoreActions {
  /** Set the user's preferred locale */
  setLocale: (locale: string) => void;

  /** Clear the user's preferred locale (use browser default) */
  clearLocale: () => void;
}

type LocaleStore = LocaleStoreState & LocaleStoreActions;

export const useLocaleStore = create<LocaleStore>()(
  persist(
    shared(
      (set) => ({
        selectedLocale: null,

        setLocale(locale) {
          set({ selectedLocale: locale });
        },

        clearLocale() {
          set({ selectedLocale: null });
        },
      }),
      { name: "locale" },
    ),
    { name: "locale" },
  ),
);

import { Routes, Route } from "react-router-dom";
import {
  Box,
  Button,
  HStack,
  Text,
  createToaster,
  Toaster,
  Toast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import ItemDetail from "./ItemDetail";
import ItemsList from "./ItemsList";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function App() {
  const [showInstallBar, setShowInstallBar] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const statusToaster = useMemo(
    () =>
      createToaster({
        placement: "top-end",
        pauseOnPageIdle: true,
      }),
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const ua = window.navigator.userAgent;
    const isAndroid = /Android/i.test(ua);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      if (!isAndroid || isStandalone) {
        return;
      }
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setShowInstallBar(true);
    };

    const handleAppInstalled = () => {
      setShowInstallBar(false);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setShowInstallBar(false);
    setInstallPrompt(null);
  };

  return (
    <>
      {showInstallBar && (
        <Box bg="blue.600" color="white" px={4} py={3}>
          <HStack justify="space-between" gap={3} flexWrap="wrap">
            <Text fontWeight="semibold">
              Install this app for a faster, full-screen experience.
            </Text>
            <Button
              colorPalette="whiteAlpha"
              variant="solid"
              onClick={handleInstallClick}
            >
              Install
            </Button>
          </HStack>
        </Box>
      )}
      <Toaster toaster={statusToaster} minW="30%" width="90%" maxWidth={500}>
        {(toast) => (
          <Toast.Root>
            <Toast.Title>{toast.title}</Toast.Title>
            {toast.description && (
              <Toast.Description>{toast.description}</Toast.Description>
            )}
            <Toast.CloseTrigger />
          </Toast.Root>
        )}
      </Toaster>
      <Routes>
        <Route path="/" element={<ItemsList statusToaster={statusToaster} />} />
        <Route path="/item/:itemId" element={<ItemDetail />} />
        <Route path="/combined/:combinedId" element={<ItemDetail />} />
      </Routes>
    </>
  );
}

export default App;

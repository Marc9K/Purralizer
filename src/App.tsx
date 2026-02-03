import { Routes, Route } from "react-router-dom";
import {
  Box,
  HStack,
  Text,
  createToaster,
  Toaster,
  Toast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import ItemDetail from "./ItemDetail";
import ItemsList from "./ItemsList";

function App() {
  const [showInstallBar, setShowInstallBar] = useState(false);
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
    const isIos =
      /iPad|iPhone|iPod/i.test(ua) ||
      (ua.includes("Mac") && "ontouchend" in document);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;
    setShowInstallBar(isIos && !isStandalone);
  }, []);

  return (
    <>
      {showInstallBar && (
        <Box bg="blue.600" color="white" px={4} py={3}>
          <HStack justify="space-between" gap={3} flexWrap="wrap">
            <Text fontWeight="semibold">
              Install this app: tap Share, then more and "Add to Home Screen"
            </Text>
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

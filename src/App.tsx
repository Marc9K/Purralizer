import { Routes, Route } from "react-router-dom";
import { createToaster, Toaster, Toast } from "@chakra-ui/react";
import { useMemo } from "react";
import ItemDetail from "./ItemDetail";
import ItemsList from "./ItemsList";

function App() {
  const statusToaster = useMemo(
    () =>
      createToaster({
        placement: "top-end",
        pauseOnPageIdle: true,
      }),
    []
  );

  return (
    <>
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

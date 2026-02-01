import { Routes, Route } from "react-router-dom";
import ItemDetail from "./ItemDetail";
import ItemsList from "./ItemsList";


function App() {
  return (
    <Routes>
      <Route path="/" element={<ItemsList />} />
      <Route path="/item/:itemId" element={<ItemDetail />} />
      <Route path="/combined/:combinedId" element={<ItemDetail />} />
    </Routes>
  );
}

export default App;

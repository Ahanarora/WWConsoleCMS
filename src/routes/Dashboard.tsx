//src/routes/Dashboard.tsx

import { useEffect, useState } from "react";
import { fetchDrafts } from "../utils/firestoreHelpers";
import StatCard from "../components/StatCard";

export default function Dashboard() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    async function load() {
      const drafts = await fetchDrafts();
      setCount(drafts.length);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard label="Total Drafts" value={count} />
        <StatCard label="Stories Published" value="—" color="text-green-600" />
        <StatCard label="Themes Published" value="—" color="text-purple-600" />
      </div>

      <div className="mt-10 text-gray-600">
        <p>Welcome to your editorial console. Manage stories and themes here.</p>
      </div>
    </div>
  );
}

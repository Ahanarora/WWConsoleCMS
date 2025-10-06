interface Props {
  label: string;
  value: number | string;
  color?: string;
}

export default function StatCard({ label, value, color }: Props) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition">
      <p className="text-gray-500 text-sm">{label}</p>
      <p className={`text-3xl font-semibold mt-2 ${color || "text-blue-600"}`}>
        {value}
      </p>
    </div>
  );
}

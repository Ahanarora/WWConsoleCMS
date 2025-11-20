import { Link } from "react-router-dom";

interface Props {
  id: string;
  title: string;
  overview: string;
  onDelete: () => void;
}

export default function DraftCard({ id, title, overview, onDelete }: Props) {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition flex flex-col justify-between">
      <div>
        <h3 className="font-semibold text-lg text-gray-800 mb-1">{title}</h3>
        <p className="text-gray-600 text-sm line-clamp-3">{overview}</p>
      </div>

      <div className="flex justify-end gap-4 mt-4 text-sm">
        <Link
          to={`/app/drafts/${id}`}
          className="text-blue-600 hover:underline font-medium"
        >
          Edit
        </Link>
        <button
          onClick={onDelete}
          className="text-red-500 hover:underline font-medium"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

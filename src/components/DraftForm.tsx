import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  title: z.string().min(3, "Title is required"),
  overview: z.string().min(10, "Overview should be at least 10 characters"),
});

export type DraftFormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: DraftFormData;
  onSubmit: (data: DraftFormData) => void;
  isSubmitting?: boolean;
}

export default function DraftForm({ defaultValues, onSubmit, isSubmitting }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DraftFormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 bg-white rounded shadow">
      <div>
        <label className="block font-medium">Title</label>
        <input
          {...register("title")}
          className="mt-1 w-full border rounded px-3 py-2"
          placeholder="Enter title"
        />
        {errors.title && <p className="text-red-500 text-sm">{errors.title.message}</p>}
      </div>

      <div>
        <label className="block font-medium">Overview</label>
        <textarea
          {...register("overview")}
          className="mt-1 w-full border rounded px-3 py-2 h-32"
          placeholder="Short summary"
        />
        {errors.overview && <p className="text-red-500 text-sm">{errors.overview.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        {isSubmitting ? "Saving..." : "Save Draft"}
      </button>
    </form>
  );
}

export async function uploadToCloudinary(imageUrl: string) {
  const cloudName = "dpjnkc0dq";            // your cloud name
  const uploadPreset = "waitwhat_unsigned"; // your unsigned preset

  const formData = new FormData();
  formData.append("file", imageUrl);
  formData.append("upload_preset", uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await res.json();
  return data.secure_url; // 🔥 permanent CDN URL
}

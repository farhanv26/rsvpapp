import { NextResponse } from "next/server";
import { saveEventImage } from "@/lib/server/event-image-storage";
import { validateEventImageFile } from "@/lib/event-image";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ error: "Please choose an image to upload." }, { status: 400 });
    }

    const validationError = validateEventImageFile(image);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const imagePath = await saveEventImage(image);
    if (!imagePath) {
      return NextResponse.json({ error: "Image upload failed. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ imagePath });
  } catch (error) {
    console.error("[event-image] upload endpoint failed", error);
    return NextResponse.json(
      { error: "Could not upload image right now. Please try again." },
      { status: 500 },
    );
  }
}

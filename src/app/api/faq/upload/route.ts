import { NextRequest, NextResponse } from "next/server";
import { processDocument } from "@/lib/parser";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type))
    return NextResponse.json({ error: "Недопустимый тип файла" }, { status: 400 });
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: "Файл слишком большой (макс. 10 МБ)" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const count = await processDocument(buffer, file.type, file.name);

  return NextResponse.json({ imported: count });
}

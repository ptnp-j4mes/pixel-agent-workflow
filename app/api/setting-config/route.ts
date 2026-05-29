import { NextResponse } from "next/server";
import settingConfig from "../../config/setting-config.json";

export async function GET() {
  return NextResponse.json(settingConfig);
}

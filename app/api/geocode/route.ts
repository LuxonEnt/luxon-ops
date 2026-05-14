import { NextResponse } from "next/server";

type GoogleGeocodeResult = {
  status: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: {
      location?: {
        lat: number;
        lng: number;
      };
    };
  }>;
  error_message?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const address = String(body?.address || "").trim();

    if (!address) {
      return NextResponse.json(
        { error: "Address is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GOOGLE_MAPS_API_KEY in Vercel environment variables." },
        { status: 500 }
      );
    }

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const data = (await response.json()) as GoogleGeocodeResult;

    if (!response.ok || data.status !== "OK" || !data.results?.[0]) {
      return NextResponse.json(
        {
          error:
            data.error_message ||
            `Could not geocode address. Google status: ${data.status}`,
        },
        { status: 400 }
      );
    }

    const location = data.results[0].geometry?.location;

    if (!location) {
      return NextResponse.json(
        { error: "Google returned no latitude/longitude." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      latitude: location.lat,
      longitude: location.lng,
      formatted_address: data.results[0].formatted_address || address,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Geocoding failed." },
      { status: 500 }
    );
  }
}

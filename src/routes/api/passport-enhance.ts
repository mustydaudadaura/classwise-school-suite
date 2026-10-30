import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { editImage } from "@/lib/image-gateway.server";

const PROMPT = `Turn this photo into an official school passport photograph.
Keep the person's face, identity, skin tone, hairstyle, headwear (hijab/cap) and clothing exactly the same — do not change, beautify or morph facial features.
Replace the background with a plain, evenly lit pure white background.
Centre the head and shoulders, face looking straight ahead, eyes level, head and top of shoulders filling the frame like a standard 35x45mm passport photo.
Balance the lighting, remove shadows and colour casts, and make the image sharp and clean. No text, borders or watermarks.`;

export const Route = createFileRoute("/api/passport-enhance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Please sign in again", { status: 401 });
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) return new Response("Sign-in is not configured", { status: 500 });
        const db = createClient(url, key, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await db.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Please sign in again", { status: 401 });
        const { data: roles } = await db.from("user_roles").select("role").eq("user_id", userData.user.id).limit(1);
        if (!roles?.length) return new Response("Only school staff can enhance passport photos", { status: 403 });

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("AI is not configured", { status: 500 });
        const incoming = await request.formData();
        const image = incoming.get("image");
        if (!(image instanceof File) || !image.type.startsWith("image/")) return new Response("Upload a photo first", { status: 400 });
        if (image.size > 8 * 1024 * 1024) return new Response("Photo must be under 8 MB", { status: 400 });
        const form = new FormData();
        form.set("image", image);
        form.set("prompt", PROMPT);
        form.set("size", "1024x1536");
        form.set("quality", "medium");
        const s = incoming.get("stream");
        if (typeof s === "string") form.set("stream", s);
        const upstream = await editImage(apiKey, form);
        return new Response(upstream.body, {
          status: upstream.status,
          headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});

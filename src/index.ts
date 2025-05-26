export interface Env {
	GEMINI_API_KEY: string;
	OPENAI_API_KEY: string;
	SEO_ALT_KV: KVNamespace;
  }
  
  interface ImageInput {
	src: string;
	context?: string;
  }
  
  interface OpenAIResponse {
	choices: {
	  message: {
		content: string;
	  };
	}[];
  }
  
  // --- 🆕 Helper function: Retry logic for fetch ---
  async function fetchWithRetries(url: string, options: RequestInit, retries = 3, delayMs = 500): Promise<Response> {
	for (let i = 0; i < retries; i++) {
	  try {
		const res = await fetch(url, options);
		if (res.ok) {
		  return res;
		} else {
		  const errorText = await res.text();
		  console.warn(`Attempt ${i + 1} failed: ${errorText}`);
		}
	  } catch (err) {
		console.warn(`Attempt ${i + 1} error: ${(err as Error).message}`);
	  }
  
	  if (i < retries - 1) {
		await new Promise(resolve => setTimeout(resolve, delayMs)); // wait before retry
	  }
	}
	throw new Error("All retries failed");
  }
  // --- End Helper ---
  
  export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === "OPTIONS") {
			return new Response(null, {
			  headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type",
			  }
			});
		  }
		if (request.method !== "POST") {
		return new Response("Only POST method is supported", { status: 405 });
	  }
  
	  let data: { images?: ImageInput[], vision?: boolean };
  
	  try {
		data = await request.json();
	  } catch (err) {
		return new Response("Invalid JSON", { status: 400 });
	  }
  
	  if (!Array.isArray(data.images)) {
		return new Response("Missing 'images' array in request body", { status: 400 });
	  }
  
	  const useVision = data.vision === true;
	  const result: Record<string, string> = {};
  
	  for (const img of data.images) {
		const src = img.src;
		const context = img.context || "";
	  
		try {
		  // 🆕 First: Try to get cached alt text from KV
		  const cachedAlt = await env.SEO_ALT_KV.get(src);
		  if (cachedAlt) {
			result[src] = cachedAlt;
			continue; // Skip to next image
		  }
	  
		  if (useVision) {
			// OpenAI GPT-4o Vision call
			const res = await fetchWithRetries("https://api.openai.com/v1/chat/completions", {
			  method: "POST",
			  headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${env.OPENAI_API_KEY}`
			  },
			  body: JSON.stringify({
				model: "gpt-4o",
				messages: [
				  {
					role: "user",
					content: [
					  {
						type: "image_url",
						image_url: { url: src }
					  },
					  {
						type: "text",
						text: `Generate a short, SEO-friendly, human-like alt text for the above image, considering the following context: ${context}. Keep it under 20 words.`
					  }
					]
				  }
				],
				max_tokens: 300
			  })
			});
	  
			if (!res.ok) {
			  const errorText = await res.text();
			  result[src] = `OpenAI API Error: ${errorText}`;
			  continue;
			}
	  
			const json = await res.json() as OpenAIResponse;
			const alt = json.choices[0].message.content.trim();
	  
			if (alt) {
			  result[src] = alt;
			  // 🆕 Save newly generated alt text into KV
			  await env.SEO_ALT_KV.put(src, alt);
			} else {
			  result[src] = "Failed to generate alt text";
			}
	  
		  } else {
			result[src] = "No alt text (vision mode required)";
		  }
	  
		} catch (err: any) {
		  result[src] = `Error processing image: ${err.message || 'Unknown error'}`;
		}
	  }	  
  
	  return new Response(JSON.stringify(result), {
		headers: {
		  "Content-Type": "application/json",
		  "Access-Control-Allow-Origin": "*",        // <--- Add this
		  "Access-Control-Allow-Methods": "POST",     // <--- Add this
		  "Access-Control-Allow-Headers": "Content-Type" // <--- Add this
		}
	  });
	}
  };

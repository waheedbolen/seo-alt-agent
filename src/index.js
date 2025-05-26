export default {
	async fetch(request, env, ctx) {
	  return new Response(
		`// SEO ALT INJECTOR SCRIPT
  ${seoAltInjectorJs}`,
		{
		  headers: {
			"content-type": "text/javascript",
			"cache-control": "public, max-age=3600"
		  }
		}
	  );
	}
  };
  
  const seoAltInjectorJs = `
  (async () => {
	try {
	  const images = Array.from(document.querySelectorAll('img')).filter(img => !img.alt || img.alt.trim() === '');
	  if (images.length === 0) {
		console.log('✅ No missing alt texts found!');
		return;
	  }
	  const payload = {
		vision: true,
		images: images.map(img => ({
		  src: img.src,
		  context: img.closest('section, div, article')?.innerText.slice(0, 200) || ''
		}))
	  };
	  const res = await fetch('https://seo-alt-agent.waheed-iqbal2030.workers.dev/', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	  });
	  if (!res.ok) {
		console.error('❌ Error from SEO Alt Agent:', await res.text());
		return;
	  }
	  const altTexts = await res.json();
	  images.forEach(img => {
		if (altTexts[img.src]) {
		  img.alt = altTexts[img.src];
		}
	  });
	  console.log(\`✅ Injected alt texts into \${images.length} images.\`);
	} catch (err) {
	  console.error('❌ SEO Alt Injection failed:', err);
	}
  })();
  `;

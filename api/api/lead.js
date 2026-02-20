// api/lead.js — Vercel Serverless Function
// Receives form data from annuityhelp.net wizard and creates a GHL contact

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "https://annuityhelp.net");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { name, email, phone, zipCode, birthYear, retirementAssets } = req.body;

    // Validate
    if (!name || !email || !phone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Split name
    const parts = name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";

    // Build GHL payload
    const payload = {
      firstName,
      lastName,
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      locationId: process.env.GHL_LOCATION_ID,
      source: "annuityhelp.net",
      tags: ["annuityhelp-lead", "website"],
      customFields: [],
    };

    // Map custom fields (only if env vars are set)
    if (zipCode && process.env.GHL_FIELD_ZIP_CODE) {
      payload.customFields.push({ id: process.env.GHL_FIELD_ZIP_CODE, value: zipCode });
    }
    if (birthYear && process.env.GHL_FIELD_BIRTH_YEAR) {
      payload.customFields.push({ id: process.env.GHL_FIELD_BIRTH_YEAR, value: String(birthYear) });
    }
    if (retirementAssets && process.env.GHL_FIELD_RETIREMENT_ASSETS) {
      payload.customFields.push({ id: process.env.GHL_FIELD_RETIREMENT_ASSETS, value: retirementAssets });
    }

    // Send to GHL
    const ghlRes = await fetch("https://services.leadconnectorhq.com/contacts/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify(payload),
    });

    const ghlData = await ghlRes.json();

    if (!ghlRes.ok) {
      console.error("GHL error:", JSON.stringify(ghlData));
      return res.status(502).json({ error: "CRM submission failed" });
    }

    console.log(`Lead: ${firstName} ${lastName} | ${email} | GHL: ${ghlData.contact?.id}`);

    return res.status(200).json({ success: true, contactId: ghlData.contact?.id });

  } catch (err) {
    console.error("Lead capture error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

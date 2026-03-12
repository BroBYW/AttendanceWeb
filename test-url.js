const API_BASE = 'https://attendance2.tecyla.top';
const toApiUrl = (path) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const base = API_BASE.replace(/\/+$/, '').replace(/\/api$/i, '');
    const normalizedPath = path.replace(/\\/g, '/');
    const withoutLeadingSlash = normalizedPath.replace(/^\/+/, '');
    const withUploadsPrefix = /^(selfies|documents|polygons)\//i.test(withoutLeadingSlash)
        ? `uploads/${withoutLeadingSlash}`
        : withoutLeadingSlash;
    const cleaned = `/${withUploadsPrefix}`;
    return `${base}${cleaned}`;
}

console.log("Input:", "/uploads/selfies/2026/03/f3a27093-1909-4821-8eb9-4261b68df0c5.jpg");
console.log("Output:", toApiUrl("/uploads/selfies/2026/03/f3a27093-1909-4821-8eb9-4261b68df0c5.jpg"));

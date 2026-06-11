export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/_headers");
  eleventyConfig.addPassthroughCopy("src/_redirects");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/llms.txt");
  eleventyConfig.addPassthroughCopy("src/favicon.svg");
  eleventyConfig.addPassthroughCopy("src/og-image.jpg");

  // Exposed to templates as {{ buildDate }} — used for sitemap <lastmod>
  eleventyConfig.addGlobalData("buildDate", () => new Date().toISOString().slice(0, 10));

  // Build-time fallback for the "BOOKING <month>" pill (one month ahead of build).
  // Client-side JS in main.js corrects this to the visitor's actual next month.
  eleventyConfig.addGlobalData("bookingMonth", () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    return months[next.getMonth()] + " " + next.getFullYear();
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_includes",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}

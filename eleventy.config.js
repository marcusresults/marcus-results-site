import { minify as minifyHtml } from "html-minifier-terser";
import { minify as minifyJs } from "terser";
import CleanCSS from "clean-css";
import fs from "node:fs";

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/functions");
  eleventyConfig.addPassthroughCopy("src/_headers");
  eleventyConfig.addPassthroughCopy("src/_redirects");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/llms.txt");
  eleventyConfig.addPassthroughCopy("src/favicon.svg");
  eleventyConfig.addPassthroughCopy("src/apple-touch-icon.png");
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

  // Minify HTML output (JSON-LD scripts are left untouched by minifyJS)
  eleventyConfig.addTransform("htmlmin", async function (content) {
    if (this.page.outputPath && this.page.outputPath.endsWith(".html")) {
      return minifyHtml(content, {
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true,
        keepClosingSlash: true,
      });
    }
    return content;
  });

  // Minify CSS + JS in place after the build copies them
  eleventyConfig.on("eleventy.after", async () => {
    const cssPath = "_site/css/main.css";
    if (fs.existsSync(cssPath)) {
      const out = new CleanCSS({ level: 1 }).minify(fs.readFileSync(cssPath, "utf8"));
      if (!out.errors.length) fs.writeFileSync(cssPath, out.styles);
    }
    const jsPath = "_site/js/main.js";
    if (fs.existsSync(jsPath)) {
      const out = await minifyJs(fs.readFileSync(jsPath, "utf8"), { compress: true, mangle: true });
      if (out.code) fs.writeFileSync(jsPath, out.code);
    }
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

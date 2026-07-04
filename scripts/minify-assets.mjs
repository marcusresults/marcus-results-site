// Runs after `eleventy` in the build script — minifies the copied
// CSS/JS in _site in place. Sequential, so it can't race the
// passthrough file copy the way an eleventy.after hook can.
import { minify as minifyJs } from "terser";
import CleanCSS from "clean-css";
import fs from "node:fs";

const cssPath = "_site/css/main.css";
if (fs.existsSync(cssPath)) {
  const before = fs.statSync(cssPath).size;
  const out = new CleanCSS({ level: 1 }).minify(fs.readFileSync(cssPath, "utf8"));
  if (out.errors.length) {
    console.error("CSS minify failed:", out.errors);
    process.exit(1);
  }
  fs.writeFileSync(cssPath, out.styles);
  console.log(`css: ${before} -> ${fs.statSync(cssPath).size} bytes`);
}

const jsPath = "_site/js/main.js";
if (fs.existsSync(jsPath)) {
  const before = fs.statSync(jsPath).size;
  const out = await minifyJs(fs.readFileSync(jsPath, "utf8"), { compress: true, mangle: true });
  if (!out.code) {
    console.error("JS minify produced no output");
    process.exit(1);
  }
  fs.writeFileSync(jsPath, out.code);
  console.log(`js: ${before} -> ${fs.statSync(jsPath).size} bytes`);
}

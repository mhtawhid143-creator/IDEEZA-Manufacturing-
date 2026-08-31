/**
 * Icons used by the components, re-exported from `@ideeza/icons`.
 *
 * That package is generated from the Figma icon library, so the shapes are
 * the design file's — nothing here is drawn by hand. Need another glyph?
 * Add it to the package (`pnpm --filter @ideeza/icons fetch <name>`) rather
 * than writing a path.
 *
 * The aliases keep call sites readable: `ChevronDown` says what it does,
 * `ArrowDown01Round` says which Figma component it is.
 */
export {
  ArrowDown01Round as ChevronDown,
  ArrowUp01Round as ChevronUp,
  Tick02 as Check,
  Remove01 as Minus,
  Add01 as Plus,
  Cancel01 as Close,
  Search01 as Search,
  AlertCircle,
  HelpCircle,
  InformationCircle,
  type IconProps,
} from "../icons-vendor/index.js";

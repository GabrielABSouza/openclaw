import { handleSource } from './commands/source.ts';
import { handleArticle } from './commands/article.ts';
import { handleRec } from './commands/rec.ts';
import { handlePub } from './commands/pub.ts';
import { handleCrossref, handleGaps, handleDigest } from './commands/analysis.ts';
import { handleStats, handlePrune, handleExport, handleImport } from './commands/maintenance.ts';
import { handleScout } from './commands/scout.ts';
import { handleRecFlow } from './commands/rec-flow.ts';
import { error, print } from './output.ts';

const args = process.argv.slice(2);
const entity = args[0];
const action = args[1];

try {
  switch (entity) {
    case 'source':   handleSource(action, args.slice(2)); break;
    case 'article':  handleArticle(action, args.slice(2)); break;
    case 'rec':      handleRec(action, args.slice(2)); break;
    case 'pub':      handlePub(action, args.slice(2)); break;
    case 'scout':    handleScout(action, args.slice(2)); break;
    case 'rec-flow': handleRecFlow(action, args.slice(2)); break;
    case 'crossref': handleCrossref(args.slice(1)); break;
    case 'gaps':     handleGaps(args.slice(1)); break;
    case 'digest':   handleDigest(args.slice(1)); break;
    case 'stats':    handleStats(); break;
    case 'prune':    handlePrune(args.slice(1)); break;
    case 'export':   handleExport(args.slice(1)); break;
    case 'import':   handleImport(args.slice(1)); break;
    default:
      print(error('cli', 'UNKNOWN_COMMAND', `Unknown command: ${entity || '(empty)'}. Available: source, article, rec, rec-flow, pub, scout, crossref, gaps, digest, stats, prune, export, import`));
  }
} catch (e: any) {
  print(error('cli', 'DB_ERROR', e.message || String(e)));
}

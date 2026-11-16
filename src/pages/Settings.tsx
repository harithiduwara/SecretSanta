import { Database, Download, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useRef } from 'react';
import { parseBackup, useEvents } from '../store/events';
import { download } from '../lib/download';
import { toast } from '../store/ui';
import { Button, Card } from '../components/ui';

export default function Settings() {
  const { events, importEvents, clearAll } = useEvents();
  const fileRef = useRef<HTMLInputElement>(null);

  const onImport = async (f?: File) => {
    if (!f) return;
    try {
      if (f.size > 10_000_000) throw new Error('File is too large (max 10 MB).');
      const added = importEvents(parseBackup(await f.text()));
      toast(
        added ? `Imported ${added} exchange${added === 1 ? '' : 's'}` : 'Nothing new to import',
        added ? 'success' : 'info',
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-slate-500">Data management, backups and privacy.</p>
      </div>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <Database className="mt-0.5 text-brand-600" size={22} />
          <div className="flex-1">
            <h2 className="font-semibold">Backup & restore</h2>
            <p className="mt-1 text-sm text-slate-500">
              {events.length} exchange{events.length === 1 ? '' : 's'} stored in this browser. Export a JSON
              backup to move to another device or share administration with a co-organizer.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                icon={<Download size={16} />}
                disabled={!events.length}
                onClick={() =>
                  download(
                    `secretsanta-backup-${new Date().toISOString().slice(0, 10)}.json`,
                    JSON.stringify(
                      { app: 'secretsanta', version: 1, exportedAt: new Date().toISOString(), events },
                      null,
                      2,
                    ),
                  )
                }
              >
                Export all
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => onImport(e.target.files?.[0])}
              />
              <Button
                variant="secondary"
                icon={<Upload size={16} />}
                onClick={() => fileRef.current?.click()}
              >
                Import backup
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <ShieldCheck className="mt-0.5 text-pine-600" size={22} />
          <div>
            <h2 className="font-semibold">Privacy & security</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
              <li>No backend, no tracking: all data lives in this browser's local storage.</li>
              <li>
                Reveal links carry an AES-256-GCM encrypted payload in the URL fragment, which is never sent
                to any server.
              </li>
              <li>
                With access codes enabled, the key is derived with PBKDF2-SHA-256 (210k iterations) from each
                person's code.
              </li>
              <li>Draws use the Web Crypto CSPRNG and are independently re-validated before saving.</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card className="border-red-200 p-6 dark:border-red-900/50">
        <div className="flex items-start gap-4">
          <Trash2 className="mt-0.5 text-red-600" size={22} />
          <div className="flex-1">
            <h2 className="font-semibold">Danger zone</h2>
            <p className="mt-1 text-sm text-slate-500">
              Permanently remove every exchange from this browser.
            </p>
            <Button
              variant="danger"
              className="mt-4"
              disabled={!events.length}
              onClick={() => {
                if (window.prompt('Type DELETE to erase all data') === 'DELETE') {
                  clearAll();
                  toast('All data erased', 'info');
                }
              }}
            >
              Erase all data
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

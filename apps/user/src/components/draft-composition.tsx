'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Checkbox,
  FormField,
  Input,
  Select,
  Tag,
  Text,
} from '@ideeza/ui';
import {
  PRINT_MATERIALS,
  PRINT_TECHNOLOGY_LABEL,
  PRINT_TECHNOLOGIES,
  SURFACE_FINISHES,
  SURFACE_FINISH_LABEL,
  usesInfill,
  type PrintTechnology,
} from '@ideeza/domain';

export interface CompositionFile {
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  /** Derived on the server from the file name. */
  readonly kind: 'pcb' | 'model_3d' | 'document';
}

export interface DraftCompositionProps {
  readonly files: readonly CompositionFile[];
  readonly selectedFileIds: readonly string[];
  readonly print: {
    readonly technology: string;
    readonly material: string;
    readonly color: string;
    readonly surfaceFinish: string;
    readonly infillPercent: string;
  };
  readonly fileError?: string | undefined;
  /** Tells the form what is in the package, so it can follow it. */
  readonly onCompositionChange?: (composition: {
    readonly hasBoard: boolean;
    readonly hasModel: boolean;
  }) => void;
}

const GROUPS = [
  {
    kind: 'pcb' as const,
    title: 'PCB items',
    note: 'Board files: gerbers, drill files and their archives.',
  },
  {
    kind: 'model_3d' as const,
    title: '3D module',
    note: 'Model files: STL, STEP, 3MF and the like.',
  },
  {
    kind: 'document' as const,
    title: 'Documents',
    note: 'Bills of materials, drawings and notes that travel with the request.',
  },
];

/**
 * What goes to manufacture, chosen group by group.
 *
 * A 3D module can be sent on its own, so the package kind is not something the
 * buyer answers separately — it follows from what is ticked here, and is read
 * back so there is no doubt about what is being asked for. The print
 * specification appears only when a model file is included, because a bare board
 * has no material or infill.
 */
export const DraftComposition = ({
  files,
  selectedFileIds,
  print,
  fileError,
  onCompositionChange,
}: DraftCompositionProps) => {
  const [selected, setSelected] = useState<readonly string[]>(selectedFileIds);
  const [technology, setTechnology] = useState(print.technology);
  const [material, setMaterial] = useState(print.material);

  const includes = (kind: CompositionFile['kind']): boolean =>
    files.some((file) => file.kind === kind && selected.includes(file.id));

  const derivedKind = useMemo(() => {
    const board = includes('pcb');
    const model = includes('model_3d');
    if (board && model) return 'Full product — board and printed parts';
    if (model) return '3D module only';
    if (board) return 'PCB only';
    return 'Nothing that can be made yet';
  }, [selected, files]);

  useEffect(() => {
    onCompositionChange?.({ hasBoard: includes('pcb'), hasModel: includes('model_3d') });
  }, [selected, files, onCompositionChange]);

  const toggleFile = (fileId: string): void => {
    setSelected((current) =>
      current.includes(fileId)
        ? current.filter((id) => id !== fileId)
        : [...current, fileId],
    );
  };

  const toggleGroup = (kind: CompositionFile['kind'], on: boolean): void => {
    const ids = files.filter((file) => file.kind === kind).map((file) => file.id);
    setSelected((current) =>
      on
        ? [...new Set([...current, ...ids])]
        : current.filter((id) => !ids.includes(id)),
    );
  };

  const materials =
    technology === '' ? [] : PRINT_MATERIALS[technology as PrintTechnology];
  const showInfill = technology !== '' && usesInfill(technology as PrintTechnology);
  const needsPrintSpec = includes('model_3d');

  return (
    <div className="flex flex-col gap-5">
      {/* The selection is posted as the form's file ids. */}
      {selected.map((fileId) => (
        <input key={fileId} type="hidden" name="fileIds" value={fileId} />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Text tone="muted" size="xs">
          Sending
        </Text>
        <Tag tone="brand">{derivedKind}</Tag>
      </div>

      {files.length === 0 ? (
        <Text tone="muted" size="sm">
          This product has no files on record, so it cannot be sent to manufacture.
        </Text>
      ) : (
        GROUPS.filter((group) => files.some((file) => file.kind === group.kind)).map(
          (group) => {
            const groupFiles = files.filter((file) => file.kind === group.kind);
            const allOn = groupFiles.every((file) => selected.includes(file.id));
            const someOn = groupFiles.some((file) => selected.includes(file.id));

            return (
              <fieldset
                key={group.kind}
                className="rounded-lg border border-border-subtle"
                aria-label={group.title}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
                  <Checkbox
                    label={`${group.title} (${groupFiles.length} ${
                      groupFiles.length === 1 ? 'item' : 'items'
                    })`}
                    description={group.note}
                    checked={allOn}
                    onChange={(event) => toggleGroup(group.kind, event.target.checked)}
                  />
                  {someOn && !allOn && (
                    <Text tone="muted" size="xs">
                      Some selected
                    </Text>
                  )}
                </div>
                <ul className="flex flex-col">
                  {groupFiles.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-2.5 last:border-b-0"
                    >
                      <Checkbox
                        label={file.name}
                        description={`revision ${file.revision}`}
                        checked={selected.includes(file.id)}
                        onChange={() => toggleFile(file.id)}
                      />
                    </li>
                  ))}
                </ul>
              </fieldset>
            );
          },
        )
      )}

      {fileError !== undefined && (
        <Text tone="danger" size="xs">
          {fileError}
        </Text>
      )}

      {needsPrintSpec && (
        <div className="rounded-lg border border-border-subtle p-4">
          <p className="text-sm font-semibold text-text-primary">Print specification</p>
          <Text tone="muted" size="xs" className="mt-0.5">
            A printer quotes on the process, the material and the finish, so these
            travel with the request rather than sitting in a note.
          </Text>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Process" required>
              <Select
                name="printTechnology"
                value={technology}
                placeholder="Choose a process"
                options={PRINT_TECHNOLOGIES.map((value) => ({
                  value,
                  label: PRINT_TECHNOLOGY_LABEL[value],
                }))}
                onChange={(event) => {
                  setTechnology(event.target.value);
                  setMaterial('');
                }}
              />
            </FormField>

            <FormField
              label="Print material"
              required
              hint={
                technology === ''
                  ? 'Choose a process first: the materials depend on it.'
                  : undefined
              }
            >
              <Select
                name="printMaterial"
                value={material}
                placeholder="Choose a material"
                disabled={technology === ''}
                options={materials.map((value) => ({ value, label: value }))}
                onChange={(event) => setMaterial(event.target.value)}
              />
            </FormField>

            <FormField label="Colour">
              <Input name="printColor" defaultValue={print.color} placeholder="Matte black" />
            </FormField>

            <FormField label="Surface finish">
              <Select
                name="surfaceFinish"
                defaultValue={print.surfaceFinish}
                placeholder="As printed"
                options={SURFACE_FINISHES.map((value) => ({
                  value,
                  label: SURFACE_FINISH_LABEL[value],
                }))}
              />
            </FormField>

            {showInfill && (
              <FormField label="Infill %" hint="Between 10 and 100.">
                <Input
                  name="infillPercent"
                  inputMode="numeric"
                  defaultValue={print.infillPercent}
                  placeholder="20"
                />
              </FormField>
            )}
          </div>
        </div>
      )}

      {!includes('pcb') && includes('model_3d') && (
        <Text tone="muted" size="xs">
          No board is included, so nothing will be assembled: this request is for the
          printed parts alone.
        </Text>
      )}
    </div>
  );
};

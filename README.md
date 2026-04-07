# PAWN to OMP Converter

Automatically converts legacy PAWN/SA-MP syntax to modern open.mp (OMP) syntax in `.pwn` and `.inc` files.

## What it does

Converts numeric parameters to proper boolean values and named constants:

### Boolean Conversions (0/1 → false/true)

- `ApplyAnimation` - Parameters 5-8 (loop, lockX, lockY, freeze)
- `TextDrawUseBox` - Parameter 2 (enableBox)
- `PlayerTextDrawUseBox` - Parameter 3 (boxEnabled)
- `TogglePlayerControllable` - Parameter 2 (toggle)
- `TextDrawSetSelectable` - Parameter 2 (selectable)
- `PlayerTextDrawSetSelectable` - Parameter 3 (selectable)

### Font Constant Conversions (0-5 → TEXT_DRAW_FONT_X)

- `TextDrawFont` - Parameter 2
- `PlayerTextDrawFont` - Parameter 3

## Examples

**Before:**
```pawn
ApplyAnimation(playerid, "CARRY", "liftup05", 4.1, 0, 1, 1, 0, 0);
TextDrawFont(bpTD[0], 1);
TextDrawUseBox(textid, 1);
TogglePlayerControllable(playerid, 0);
```

**After:**
```pawn
ApplyAnimation(playerid, "CARRY", "liftup05", 4.1, false, true, true, false, 0);
TextDrawFont(bpTD[0], TEXT_DRAW_FONT_1);
TextDrawUseBox(textid, true);
TogglePlayerControllable(playerid, false);
```

## Usage

1. Place the script in your project root directory
2. Run the converter:
   ```bash
   node omp-converter.js
   ```

The script will:
- Recursively scan all `.pwn` and `.inc` files
- Create `.bak` backup files before modifying

## Safety

- Automatic backups (`.bak` files) are created for all modified files
- Review changes before deleting backups
- If something goes wrong, restore from `.bak` files

## Requirements

- Node.js (any recent version)

## Adding More Functions

To add more conversion rules, edit the `CONVERSION_RULES` array:

```javascript
{
    name: 'FunctionName',
    conversions: [
        { paramIndex: 1, type: 'boolean' }, // for 0/1 → false/true
        { paramIndex: 2, type: 'constant', mapping: FONT_MAPPING } // for constants
    ]
}
```

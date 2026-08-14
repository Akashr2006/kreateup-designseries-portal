/**
 * ===========================================================================
 * KreateUp DesignSeries Portal — Google Sheets connector
 * ===========================================================================
 *
 * Paste this whole file into the Apps Script editor bound to your Spreadsheet
 * (Extensions ▸ Apps Script), then use the "KreateUp Portal" menu that appears
 * on the sheet toolbar after a reload.
 *
 * WHAT IT DOES
 *   1. Builds all 12 sheets with the exact columns of prisma/schema.prisma.
 *   2. Applies professional formatting: brand-blue headers, frozen panes,
 *      banded rows, sensible column widths, dropdowns on every enum column and
 *      colour-coded conditional formatting on every status column.
 *   3. Watches for edits, row inserts and row deletes, and POSTs them to the
 *      portal so the local database stays in sync.
 *
 * ---------------------------------------------------------------------------
 * THREE THINGS THAT WILL BITE YOU IF YOU DEVIATE — please read
 * ---------------------------------------------------------------------------
 *
 *  (a) The *simple* onEdit(e) trigger runs without authorization and therefore
 *      CANNOT call UrlFetchApp. A webhook written as `function onEdit(e)` fails
 *      silently forever. That is why the handlers below are named
 *      `handleEdit` / `handleChange` and are attached as INSTALLABLE triggers
 *      by `installTriggers()`. Do not rename them to onEdit/onChange.
 *
 *  (b) Edits made through the Google Sheets API do NOT fire Apps Script
 *      triggers. That is a feature here, not a limitation: when the portal
 *      writes to the sheet, no webhook bounces back, so there is no infinite
 *      echo loop between the two systems.
 *
 *  (c) A deleted row cannot be read after the fact — `onChange` tells you a row
 *      went away but not what was in it. So on REMOVE_ROW this script sends the
 *      surviving id list (or asks for a reconcile on very large sheets) and
 *      lets the server work out which records disappeared.
 *
 * ---------------------------------------------------------------------------
 * SETUP (once)
 * ---------------------------------------------------------------------------
 *   1. Reload the spreadsheet. A "KreateUp Portal" menu appears.
 *   2. KreateUp Portal ▸ 1. Configure connection…
 *        Webhook URL:  https://your-app.vercel.app/api/webhooks/google-sheets-sync
 *        Shared secret: the same value as SHEETS_WEBHOOK_SECRET in your .env
 *   3. KreateUp Portal ▸ 2. Build / repair all sheets
 *   4. KreateUp Portal ▸ 3. Install sync triggers   (approve the OAuth prompt)
 *   5. KreateUp Portal ▸ 4. Test connection
 * ===========================================================================
 */

/* eslint-disable no-var */

// ---------------------------------------------------------------------------
// Brand palette — taken from the KreateUp wordmark
// ---------------------------------------------------------------------------

var BRAND = {
  blue: '#1A73E8',
  red: '#EA4335',
  amber: '#F9AB00',
  green: '#34A853',
  headerText: '#FFFFFF',
  bandLight: '#F8F9FC',
  bandDark: '#ECEFF7',
  border: '#D5DDED',
  muted: '#5F6673'
};

/** Soft background / strong foreground pairs used by conditional formatting. */
var TONE = {
  green: { bg: '#E6F4EA', fg: '#137333' },
  amber: { bg: '#FEF7E0', fg: '#B06000' },
  red: { bg: '#FCE8E6', fg: '#C5221F' },
  blue: { bg: '#E8F0FE', fg: '#1967D2' },
  grey: { bg: '#F1F3F4', fg: '#5F6673' }
};

// ---------------------------------------------------------------------------
// Enum vocabularies — must match src/lib/constants.ts exactly
// ---------------------------------------------------------------------------

var ENUM = {
  role: ['STUDENT', 'MENTOR', 'ADMIN', 'SUPER_ADMIN'],
  systemStatus: ['ACTIVE', 'SUSPENDED'],
  bool: ['TRUE', 'FALSE'],

  attendanceStatus: ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'],
  attendanceSource: ['SELF', 'ADMIN', 'QR'],
  attendanceHour: ['1', '2', '3', '4', '5', '6', '7'],

  worklogStatus: ['SUBMITTED', 'REVIEWED', 'FLAGGED'],

  taskStatus: ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'DONE', 'BLOCKED'],
  taskPriority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],

  passStatus: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
  passCategory: ['ACTIVITY', 'MEDICAL', 'PLACEMENT', 'EVENT', 'OTHER'],

  notificationCategory: ['GENERAL', 'URGENT', 'EVENT', 'DEADLINE', 'RESULT'],
  notificationAudience: ['ALL', 'YEAR', 'DOMAIN', 'ROLE'],

  noteColor: ['blue', 'red', 'amber', 'green', 'slate'],

  rewardSource: ['ATTENDANCE', 'WORKLOG', 'TASK', 'LINKEDIN', 'MANUAL'],

  extensionStatus: ['PENDING', 'APPROVED', 'REJECTED']
};

/** Colour rules applied to any column whose name appears here. */
var STATUS_COLOURS = {
  PRESENT: TONE.green, LATE: TONE.amber, EXCUSED: TONE.blue, ABSENT: TONE.red,
  SUBMITTED: TONE.blue, REVIEWED: TONE.green, FLAGGED: TONE.red,
  TODO: TONE.grey, IN_PROGRESS: TONE.blue, DONE: TONE.green, BLOCKED: TONE.red,
  PENDING: TONE.amber, APPROVED: TONE.green, REJECTED: TONE.red, CANCELLED: TONE.grey,
  ACTIVE: TONE.green, SUSPENDED: TONE.red,
  LOW: TONE.grey, MEDIUM: TONE.blue, HIGH: TONE.amber, CRITICAL: TONE.red,
  URGENT: TONE.red, DEADLINE: TONE.amber, GENERAL: TONE.blue, RESULT: TONE.blue,
  STUDENT: TONE.blue, MENTOR: TONE.amber, ADMIN: TONE.green, SUPER_ADMIN: TONE.red,
  TRUE: TONE.green, FALSE: TONE.grey
};

// ---------------------------------------------------------------------------
// Schema — one entry per sheet, mirroring prisma/schema.prisma
//
//   name       column header (also the JSON key sent to the portal)
//   w          column width in pixels
//   enum       dropdown values, if any
//   note       help text shown on hover over the header cell
// ---------------------------------------------------------------------------

function col(name, w, enumKey, note) {
  return { name: name, w: w || 150, enumKey: enumKey || null, note: note || '' };
}

var SCHEMA = [
  {
    sheet: 'Users',
    key: 'id',
    columns: [
      col('id', 210, null, 'Primary key. Generated by the portal — never edit.'),
      col('name', 200),
      col('rollNo', 140, null, 'Unique. Also the barcode value on a student card.'),
      col('email', 250, null, 'Unique. This is the sign-in identifier.'),
      col('department', 260),
      col('year', 180),
      col('mobile', 120),
      col('domain', 240),
      col('mentorName', 200),
      col('linkedin', 240),
      col('github', 220),
      col('role', 130, 'role'),
      col('systemStatus', 130, 'systemStatus', 'SUSPENDED blocks sign-in immediately.'),
      col('passwordHash', 260, null, 'bcrypt hash. Never type a plain password here.'),
      col('mustChangePassword', 150, 'bool'),
      col('rewardPoints', 110, null, 'Running total of the RewardEntries ledger.'),
      col('avatarSeed', 100),
      col('createdAt', 170),
      col('updatedAt', 170)
    ]
  },
  {
    sheet: 'Attendance',
    key: 'id',
    columns: [
      col('id', 210),
      col('userId', 210),
      col('date', 110, null, 'YYYY-MM-DD.'),
      col('hour', 80, 'attendanceHour'),
      col('reason', 380),
      col('status', 120, 'attendanceStatus'),
      col('source', 100, 'attendanceSource'),
      col('markedBy', 210, null, 'Admin user id when source is ADMIN or QR.'),
      col('createdAt', 170)
    ]
  },
  {
    sheet: 'Worklogs',
    key: 'id',
    columns: [
      col('id', 210),
      col('userId', 210),
      col('date', 110),
      col('s1', 320, null, 'Slot 1 · 08:45–10:25'),
      col('s2', 320, null, 'Slot 2 · 10:40–12:30'),
      col('s3', 320, null, 'Slot 3 · 13:30–15:10'),
      col('s4', 320, null, 'Slot 4 · 15:25–16:25'),
      col('s5', 320, null, 'Extra · after hours, optional'),
      col('taskId', 210),
      col('status', 120, 'worklogStatus'),
      col('mentorRemark', 320),
      col('reviewedBy', 210),
      col('reviewedAt', 170),
      col('createdAt', 170),
      col('updatedAt', 170)
    ]
  },
  {
    sheet: 'Tasks',
    key: 'id',
    columns: [
      col('id', 210),
      col('title', 300),
      col('description', 380),
      col('authorId', 210),
      col('assigneeId', 210),
      col('domain', 240),
      col('year', 180),
      col('priority', 110, 'taskPriority'),
      col('status', 130, 'taskStatus'),
      col('dueDate', 110),
      col('points', 90),
      col('completedAt', 170),
      col('createdAt', 170),
      col('updatedAt', 170)
    ]
  },
  {
    sheet: 'ActivityPasses',
    key: 'id',
    columns: [
      col('id', 210),
      col('userId', 210),
      col('date', 110),
      col('fromTime', 100),
      col('toTime', 100),
      col('destination', 240),
      col('reason', 380),
      col('category', 120, 'passCategory'),
      col('status', 120, 'passStatus'),
      col('passCode', 150, null, 'Unique. Encoded as Code 39 on the printed pass.'),
      col('remark', 300),
      col('reviewerId', 210),
      col('reviewedAt', 170),
      col('createdAt', 170),
      col('updatedAt', 170)
    ]
  },
  {
    sheet: 'Notifications',
    key: 'id',
    columns: [
      col('id', 210),
      col('title', 300),
      col('body', 460),
      col('category', 120, 'notificationCategory'),
      col('audience', 110, 'notificationAudience'),
      col('audienceValue', 220, null, 'The year / domain / role matched when audience is not ALL.'),
      col('pinned', 90, 'bool'),
      col('link', 240),
      col('authorId', 210),
      col('createdAt', 170)
    ]
  },
  {
    sheet: 'NotificationReads',
    key: 'id',
    columns: [
      col('id', 210),
      col('notificationId', 210),
      col('userId', 210),
      col('readAt', 170)
    ]
  },
  {
    sheet: 'Notes',
    key: 'id',
    columns: [
      col('id', 210),
      col('userId', 210),
      col('title', 240),
      col('body', 460, null, 'PRIVATE to the student. Do not read or edit casually.'),
      col('color', 100, 'noteColor'),
      col('pinned', 90, 'bool'),
      col('createdAt', 170),
      col('updatedAt', 170)
    ]
  },
  {
    sheet: 'LinkedinPosts',
    key: 'id',
    columns: [
      col('id', 210),
      col('userId', 210),
      col('url', 340),
      col('caption', 380),
      col('postedOn', 110),
      col('reactions', 100),
      col('comments', 100),
      col('verified', 100, 'bool', 'Flipping this to TRUE awards reward points in the portal.'),
      col('createdAt', 170)
    ]
  },
  {
    sheet: 'RewardEntries',
    key: 'id',
    columns: [
      col('id', 210),
      col('userId', 210),
      col('points', 90, null, 'Negative values claw points back.'),
      col('reason', 340),
      col('source', 120, 'rewardSource'),
      col('createdAt', 170)
    ]
  },
  {
    sheet: 'ExtensionRequests',
    key: 'id',
    columns: [
      col('id', 210),
      col('userId', 210),
      col('date', 110, null, 'The locked worklog day being reopened.'),
      col('reason', 380),
      col('status', 120, 'extensionStatus'),
      col('remark', 300),
      col('reviewerId', 210),
      col('reviewedAt', 170),
      col('createdAt', 170)
    ]
  },
  {
    sheet: 'AuditLogs',
    key: 'id',
    columns: [
      col('id', 210),
      col('actorId', 210),
      col('action', 190),
      col('entity', 150),
      col('entityId', 210),
      col('meta', 380),
      col('createdAt', 170)
    ]
  }
];

/** Fast lookup: sheet name -> schema entry. */
function schemaFor(sheetName) {
  for (var i = 0; i < SCHEMA.length; i++) {
    if (SCHEMA[i].sheet === sheetName) return SCHEMA[i];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('KreateUp Portal')
    .addItem('1. Configure connection…', 'configureConnection')
    .addItem('2. Build / repair all sheets', 'setupWorkbook')
    .addItem('3. Install sync triggers', 'installTriggers')
    .addItem('4. Test connection', 'testConnection')
    .addSeparator()
    .addItem('Re-apply formatting only', 'applyFormattingOnly')
    .addItem('Push a whole sheet to the portal…', 'pushWholeSheet')
    .addSeparator()
    .addItem('Show sync status', 'showStatus')
    .addItem('Remove sync triggers', 'removeTriggers')
    .addToUi();
}

// ---------------------------------------------------------------------------
// Configuration (stored in Script Properties, never hard-coded)
// ---------------------------------------------------------------------------

var PROP_URL = 'WEBHOOK_URL';
var PROP_SECRET = 'WEBHOOK_SECRET';
var PROP_ENABLED = 'SYNC_ENABLED';

function props() {
  return PropertiesService.getScriptProperties();
}

function configureConnection() {
  var ui = SpreadsheetApp.getUi();
  var store = props();

  var urlPrompt = ui.prompt(
    'Portal webhook URL',
    'Paste the full endpoint, e.g.\nhttps://your-app.vercel.app/api/webhooks/google-sheets-sync',
    ui.ButtonSet.OK_CANCEL
  );
  if (urlPrompt.getSelectedButton() !== ui.Button.OK) return;

  var url = urlPrompt.getResponseText().trim();
  if (url.indexOf('https://') !== 0 && url.indexOf('http://localhost') !== 0) {
    ui.alert('That does not look like a valid URL. It must start with https:// (or http://localhost for testing).');
    return;
  }

  var secretPrompt = ui.prompt(
    'Shared secret',
    'Must match SHEETS_WEBHOOK_SECRET in your portal .env file.',
    ui.ButtonSet.OK_CANCEL
  );
  if (secretPrompt.getSelectedButton() !== ui.Button.OK) return;

  var secret = secretPrompt.getResponseText().trim();
  if (secret.length < 16) {
    ui.alert('Use a secret of at least 16 characters.');
    return;
  }

  store.setProperty(PROP_URL, url);
  store.setProperty(PROP_SECRET, secret);
  store.setProperty(PROP_ENABLED, 'true');

  ui.alert('Saved.\n\nNext: "2. Build / repair all sheets", then "3. Install sync triggers".');
}

function showStatus() {
  var store = props();
  var triggers = ScriptApp.getProjectTriggers();
  var installed = 0;
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === 'handleEdit' || fn === 'handleChange') installed++;
  }

  SpreadsheetApp.getUi().alert(
    'KreateUp sync status\n\n' +
    'Webhook URL : ' + (store.getProperty(PROP_URL) || '— not configured —') + '\n' +
    'Secret set  : ' + (store.getProperty(PROP_SECRET) ? 'yes' : 'NO') + '\n' +
    'Sync enabled: ' + (store.getProperty(PROP_ENABLED) === 'true' ? 'yes' : 'no') + '\n' +
    'Triggers    : ' + installed + ' of 2 installed\n' +
    'Sheets      : ' + SCHEMA.length + ' defined'
  );
}

// ---------------------------------------------------------------------------
// Workbook construction & formatting
// ---------------------------------------------------------------------------

function setupWorkbook() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var created = 0;
  var repaired = 0;

  for (var i = 0; i < SCHEMA.length; i++) {
    var def = SCHEMA[i];
    var sheet = ss.getSheetByName(def.sheet);

    if (!sheet) {
      sheet = ss.insertSheet(def.sheet);
      created++;
    } else {
      repaired++;
    }

    writeHeaders(sheet, def);
    formatSheet(sheet, def);
  }

  // Drop the default "Sheet1" if it is still empty and unused.
  var leftover = ss.getSheetByName('Sheet1');
  if (leftover && ss.getSheets().length > 1 && leftover.getLastRow() === 0) {
    ss.deleteSheet(leftover);
  }

  ss.setActiveSheet(ss.getSheetByName('Users'));

  ui.alert(
    'Workbook ready.\n\n' +
    created + ' sheet(s) created, ' + repaired + ' checked and reformatted.\n\n' +
    'Dropdowns, colour rules, frozen headers and column widths have all been applied.'
  );
}

function applyFormattingOnly() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var i = 0; i < SCHEMA.length; i++) {
    var sheet = ss.getSheetByName(SCHEMA[i].sheet);
    if (sheet) formatSheet(sheet, SCHEMA[i]);
  }
  SpreadsheetApp.getUi().alert('Formatting re-applied to every sheet.');
}

function writeHeaders(sheet, def) {
  var headers = [];
  var notes = [];
  for (var i = 0; i < def.columns.length; i++) {
    headers.push(def.columns[i].name);
    notes.push(def.columns[i].note);
  }

  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setNotes([notes]);
}

function formatSheet(sheet, def) {
  var count = def.columns.length;
  var maxRows = Math.max(sheet.getMaxRows(), 2);

  // --- Header row -----------------------------------------------------------
  var header = sheet.getRange(1, 1, 1, count);
  header
    .setBackground(BRAND.blue)
    .setFontColor(BRAND.headerText)
    .setFontFamily('Roboto')
    .setFontSize(10)
    .setFontWeight('bold')
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('left')
    .setWrap(false);

  sheet.setRowHeight(1, 34);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1); // keep `id` on screen while scrolling right

  // --- Body -----------------------------------------------------------------
  var body = sheet.getRange(2, 1, maxRows - 1, count);
  body
    .setFontFamily('Roboto')
    .setFontSize(10)
    .setVerticalAlignment('top')
    .setWrap(false);

  // Column widths.
  for (var i = 0; i < count; i++) {
    sheet.setColumnWidth(i + 1, def.columns[i].w);
  }

  // Trim stray columns beyond the schema so the sheet stays honest.
  if (sheet.getMaxColumns() > count) {
    sheet.deleteColumns(count + 1, sheet.getMaxColumns() - count);
  }

  // The id column is machine-owned; grey it so nobody hand-types into it.
  sheet.getRange(2, 1, maxRows - 1, 1)
    .setFontColor(BRAND.muted)
    .setFontFamily('Roboto Mono');

  // --- Banding --------------------------------------------------------------
  var existing = sheet.getBandings();
  for (var b = 0; b < existing.length; b++) existing[b].remove();

  sheet.getRange(1, 1, maxRows, count)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);

  // --- Dropdowns ------------------------------------------------------------
  for (var c = 0; c < count; c++) {
    var column = def.columns[c];
    if (!column.enumKey) continue;

    var values = ENUM[column.enumKey];
    if (!values) continue;

    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true)
      .setAllowInvalid(false)
      .setHelpText(column.name + ' must be one of: ' + values.join(', '))
      .build();

    sheet.getRange(2, c + 1, maxRows - 1, 1).setDataValidation(rule);
  }

  // --- Conditional formatting on enum columns -------------------------------
  applyStatusColours(sheet, def, maxRows);

  // --- Protect the header from accidental edits -----------------------------
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  for (var p = 0; p < protections.length; p++) {
    if (protections[p].getDescription() === 'KreateUp header') protections[p].remove();
  }
  var guard = sheet.getRange(1, 1, 1, count).protect();
  guard.setDescription('KreateUp header');
  guard.setWarningOnly(true);
}

function applyStatusColours(sheet, def, maxRows) {
  var rules = [];

  for (var c = 0; c < def.columns.length; c++) {
    var column = def.columns[c];
    if (!column.enumKey) continue;

    var values = ENUM[column.enumKey];
    if (!values) continue;

    var range = sheet.getRange(2, c + 1, maxRows - 1, 1);

    for (var v = 0; v < values.length; v++) {
      var value = values[v];
      var tone = STATUS_COLOURS[value];
      if (!tone) continue;

      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .whenTextEqualTo(value)
          .setBackground(tone.bg)
          .setFontColor(tone.fg)
          .setBold(true)
          .setRanges([range])
          .build()
      );
    }
  }

  // Highlight negative reward points in red.
  if (def.sheet === 'RewardEntries') {
    var pointsIndex = indexOfColumn(def, 'points');
    if (pointsIndex > -1) {
      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .whenNumberLessThan(0)
          .setFontColor(TONE.red.fg)
          .setBold(true)
          .setRanges([sheet.getRange(2, pointsIndex + 1, maxRows - 1, 1)])
          .build()
      );
    }
  }

  sheet.setConditionalFormatRules(rules);
}

function indexOfColumn(def, name) {
  for (var i = 0; i < def.columns.length; i++) {
    if (def.columns[i].name === name) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Triggers
//
// These MUST be installable triggers. Simple onEdit/onChange run unauthorised
// and cannot use UrlFetchApp — see note (a) at the top of this file.
// ---------------------------------------------------------------------------

function installTriggers() {
  removeTriggers();

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  ScriptApp.newTrigger('handleEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('handleChange').forSpreadsheet(ss).onChange().create();

  SpreadsheetApp.getUi().alert(
    'Sync triggers installed.\n\n' +
    'Edits, row inserts and row deletes will now be pushed to the portal.\n\n' +
    'Note: changes the portal itself makes through the Sheets API do not fire ' +
    'these triggers, so there is no sync loop.'
  );
}

function removeTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === 'handleEdit' || fn === 'handleChange') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/** Installable onEdit — a human typed into one or more cells. */
function handleEdit(e) {
  try {
    if (!e || !e.range) return;

    var sheet = e.range.getSheet();
    var def = schemaFor(sheet.getName());
    if (!def) return; // not one of our data sheets

    var startRow = e.range.getRow();
    var numRows = e.range.getNumRows();
    if (startRow + numRows - 1 < 2) return; // header-only edit

    var rows = [];
    for (var r = Math.max(startRow, 2); r < startRow + numRows; r++) {
      var record = readRow(sheet, def, r);
      if (record) rows.push(record);
    }
    if (rows.length === 0) return;

    postToPortal({
      event: 'UPDATE',
      sheet: def.sheet,
      keyField: def.key,
      rows: rows,
      editedBy: safeEmail(e),
      at: new Date().toISOString()
    });
  } catch (err) {
    logFailure('handleEdit', err);
  }
}

/**
 * Installable onChange — structural changes: rows inserted, rows removed,
 * or a bulk paste/undo that onEdit does not describe well.
 */
function handleChange(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var def = schemaFor(sheet.getName());
    if (!def) return;

    var type = e && e.changeType ? e.changeType : 'OTHER';

    if (type === 'INSERT_ROW') {
      // New rows land at the bottom of the active selection; send everything
      // currently selected that has an id, and let the server upsert.
      var selection = ss.getActiveRange();
      var rows = [];
      if (selection) {
        var from = Math.max(selection.getRow(), 2);
        var to = selection.getRow() + selection.getNumRows() - 1;
        for (var r = from; r <= to; r++) {
          var record = readRow(sheet, def, r);
          if (record) rows.push(record);
        }
      }
      if (rows.length > 0) {
        postToPortal({
          event: 'INSERT',
          sheet: def.sheet,
          keyField: def.key,
          rows: rows,
          at: new Date().toISOString()
        });
      }
      return;
    }

    if (type === 'REMOVE_ROW') {
      // The deleted row is unreadable, so send the surviving ids and let the
      // portal work out what is missing — see note (c) at the top.
      var ids = collectIds(sheet, def);

      if (ids === null) {
        postToPortal({
          event: 'RECONCILE',
          sheet: def.sheet,
          keyField: def.key,
          reason: 'row removed from a large sheet; pull the full sheet to diff',
          at: new Date().toISOString()
        });
      } else {
        postToPortal({
          event: 'DELETE',
          sheet: def.sheet,
          keyField: def.key,
          survivingIds: ids,
          at: new Date().toISOString()
        });
      }
      return;
    }

    if (type === 'EDIT' || type === 'OTHER' || type === 'FORMAT') {
      return; // handleEdit already covers cell-level edits
    }
  } catch (err) {
    logFailure('handleChange', err);
  }
}

// ---------------------------------------------------------------------------
// Sheet reading helpers
// ---------------------------------------------------------------------------

/** Reads one row into a plain object keyed by column name. */
function readRow(sheet, def, rowIndex) {
  if (rowIndex < 2 || rowIndex > sheet.getLastRow()) return null;

  var width = def.columns.length;
  var values = sheet.getRange(rowIndex, 1, 1, width).getValues()[0];

  var record = { _row: rowIndex };
  var empty = true;

  for (var i = 0; i < width; i++) {
    var name = def.columns[i].name;
    var value = values[i];

    if (value instanceof Date) {
      value = value.toISOString();
    } else if (value === null || value === undefined) {
      value = '';
    } else {
      value = String(value);
    }

    if (value !== '') empty = false;
    record[name] = value;
  }

  return empty ? null : record;
}

/**
 * All ids in a sheet. Returns null when the sheet is too large to ship in a
 * single payload — the caller then asks the portal to reconcile instead.
 */
var MAX_IDS_IN_PAYLOAD = 5000;

function collectIds(sheet, def) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  if (last - 1 > MAX_IDS_IN_PAYLOAD) return null;

  var keyIndex = indexOfColumn(def, def.key);
  if (keyIndex < 0) return [];

  var values = sheet.getRange(2, keyIndex + 1, last - 1, 1).getValues();
  var ids = [];
  for (var i = 0; i < values.length; i++) {
    var id = values[i][0];
    if (id !== '' && id !== null && id !== undefined) ids.push(String(id));
  }
  return ids;
}

function safeEmail(e) {
  try {
    if (e && e.user && e.user.getEmail) return e.user.getEmail();
    return Session.getActiveUser().getEmail() || '';
  } catch (err) {
    return ''; // the script may not be authorised to read the identity
  }
}

// ---------------------------------------------------------------------------
// Outbound webhook
// ---------------------------------------------------------------------------

/**
 * Signs and POSTs a payload to the portal.
 *
 * Signature scheme (verify this exactly on the server):
 *   message   = timestamp + "." + rawJsonBody
 *   signature = lowercase hex HMAC-SHA256(message, sharedSecret)
 * Sent as:
 *   X-KreateUp-Timestamp: <ms since epoch>
 *   X-KreateUp-Signature: <hex>
 */
function postToPortal(payload) {
  var store = props();

  if (store.getProperty(PROP_ENABLED) !== 'true') return;

  var url = store.getProperty(PROP_URL);
  var secret = store.getProperty(PROP_SECRET);
  if (!url || !secret) {
    logFailure('postToPortal', new Error('Sync is not configured. Run "1. Configure connection…".'));
    return;
  }

  // Serialise one write at a time so concurrent edits cannot interleave.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    logFailure('postToPortal', new Error('Could not acquire lock; skipping this event.'));
    return;
  }

  try {
    payload.spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();

    var body = JSON.stringify(payload);
    var timestamp = String(Date.now());
    var signature = hmacHex(timestamp + '.' + body, secret);

    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: body,
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'X-KreateUp-Timestamp': timestamp,
        'X-KreateUp-Signature': signature,
        'X-KreateUp-Source': 'apps-script'
      }
    });

    var code = response.getResponseCode();
    if (code < 200 || code >= 300) {
      queueRetry(payload, code, response.getContentText());
    } else {
      store.setProperty('LAST_SYNC_OK', new Date().toISOString());
    }
  } catch (err) {
    queueRetry(payload, 0, String(err));
  } finally {
    lock.releaseLock();
  }
}

function hmacHex(message, secret) {
  var raw = Utilities.computeHmacSha256Signature(message, secret);
  var hex = '';
  for (var i = 0; i < raw.length; i++) {
    // Apps Script bytes are signed; mask back to 0-255 before hexing.
    var b = (raw[i] + 256) % 256;
    var part = b.toString(16);
    hex += part.length === 1 ? '0' + part : part;
  }
  return hex;
}

// ---------------------------------------------------------------------------
// Retry queue — survives the portal being briefly unreachable
// ---------------------------------------------------------------------------

var PROP_QUEUE = 'RETRY_QUEUE';
var MAX_QUEUE = 40;

function queueRetry(payload, code, detail) {
  var store = props();
  var queue = [];
  try {
    queue = JSON.parse(store.getProperty(PROP_QUEUE) || '[]');
  } catch (err) {
    queue = [];
  }

  queue.push({ payload: payload, code: code, detail: String(detail).slice(0, 300), at: new Date().toISOString() });
  while (queue.length > MAX_QUEUE) queue.shift();

  store.setProperty(PROP_QUEUE, JSON.stringify(queue));
  store.setProperty('LAST_SYNC_ERROR', new Date().toISOString() + ' — HTTP ' + code);
}

/** Attach this to a time-driven trigger (every 5 minutes) if you want auto-retry. */
function flushRetryQueue() {
  var store = props();
  var queue;
  try {
    queue = JSON.parse(store.getProperty(PROP_QUEUE) || '[]');
  } catch (err) {
    return;
  }
  if (queue.length === 0) return;

  store.deleteProperty(PROP_QUEUE); // clear first; failures re-queue themselves
  for (var i = 0; i < queue.length; i++) {
    postToPortal(queue[i].payload);
  }
}

function logFailure(where, err) {
  console.error('[KreateUp] ' + where + ': ' + err);
  props().setProperty('LAST_SYNC_ERROR', new Date().toISOString() + ' — ' + where + ': ' + err);
}

// ---------------------------------------------------------------------------
// Manual tools
// ---------------------------------------------------------------------------

function testConnection() {
  var ui = SpreadsheetApp.getUi();
  var store = props();

  if (!store.getProperty(PROP_URL) || !store.getProperty(PROP_SECRET)) {
    ui.alert('Run "1. Configure connection…" first.');
    return;
  }

  postToPortal({
    event: 'PING',
    sheet: 'Users',
    keyField: 'id',
    rows: [],
    at: new Date().toISOString()
  });

  var ok = store.getProperty('LAST_SYNC_OK');
  var bad = store.getProperty('LAST_SYNC_ERROR');

  ui.alert(
    'Ping sent.\n\n' +
    'Last success: ' + (ok || 'never') + '\n' +
    'Last error  : ' + (bad || 'none') + '\n\n' +
    'If you see an error, check that the URL is reachable and that the shared ' +
    'secret matches SHEETS_WEBHOOK_SECRET in the portal.'
  );
}

/** Pushes every row of the active sheet to the portal, in batches. */
function pushWholeSheet() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var def = schemaFor(sheet.getName());

  if (!def) {
    ui.alert('"' + sheet.getName() + '" is not one of the portal data sheets.');
    return;
  }

  var last = sheet.getLastRow();
  if (last < 2) {
    ui.alert('That sheet has no data rows.');
    return;
  }

  var confirm = ui.alert(
    'Push ' + (last - 1) + ' row(s) from "' + def.sheet + '" to the portal?',
    'The portal will upsert each row by its id. This overwrites the portal copy.',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  var BATCH = 200;
  var sent = 0;

  for (var start = 2; start <= last; start += BATCH) {
    var rows = [];
    var end = Math.min(start + BATCH - 1, last);
    for (var r = start; r <= end; r++) {
      var record = readRow(sheet, def, r);
      if (record) rows.push(record);
    }
    if (rows.length === 0) continue;

    postToPortal({
      event: 'UPSERT_BATCH',
      sheet: def.sheet,
      keyField: def.key,
      rows: rows,
      at: new Date().toISOString()
    });
    sent += rows.length;
    Utilities.sleep(400); // stay well inside the URL Fetch quota
  }

  ui.alert('Pushed ' + sent + ' row(s) from "' + def.sheet + '".');
}

import { CopyHelper, log } from "./utils";

/**
 * General tool APIs.
 * @public
 */
export class ZoteroTool {
  /**
   * Log options.
   * @remarks
   * default:
   * ```ts
   * {
   *   disableConsole: false,
   *   disableZLog: false,
   *   prefix: "",
   * }
   * ```
   * `_type` is for recognization, don't modify it.
   */
  logOptionsGlobal: {
    _type: "toolkitlog";
    disableConsole: boolean;
    disableZLog: boolean;
    prefix: string;
  };

  constructor() {
    this.logOptionsGlobal = {
      _type: "toolkitlog",
      disableConsole: false,
      disableZLog: false,
      prefix: "",
    };
  }
  /**
   * create a `CopyHelper` instance for text/rich text/image
   *
   * @example
   * Copy plain text
   * ```ts
   * const tool = new ZoteroTool();
   * tool.getCopyHelper().addText("plain", "text/unicode").copy();
   * ```
   * @example
   * Copy plain text & rich text
   * ```ts
   * const tool = new ZoteroTool();
   * tool.getCopyHelper().addText("plain", "text/unicode")
   *                     .addText("<h1>rich text</h1>", "text/html")
   *                     .copy();
   * ```
   * @example
   * Copy plain text, rich text & image
   * ```ts
   * const tool = new ZoteroTool();
   * tool.getCopyHelper().addText("plain", "text/unicode")
   *                     .addText("<h1>rich text</h1>", "text/html")
   *                     .addImage("data:image/png;base64,...")
   *                     .copy();
   * ```
   */
  getCopyHelper() {
    return new CopyHelper();
  }
  /**
   * Open a file picker
   * @param title window title
   * @param mode 
   * @param filters Array<[hint string, filter string]>
   * @param suggestion default file/foler
   * @example
   * ```ts
   * const tool = new ZoteroTool();
   * await tool.openFilePicker(
      `${Zotero.getString("fileInterface.import")} MarkDown Document`,
      "open",
      [["MarkDown File(*.md)", "*.md"]]
    );
    ```
   */
  openFilePicker(
    title: string,
    mode: "open" | "save" | "folder",
    filters?: [string, string][],
    suggestion?: string
  ): Promise<string> {
    const fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(
      Components.interfaces.nsIFilePicker
    );

    if (suggestion) fp.defaultString = suggestion;

    mode = {
      open: Components.interfaces.nsIFilePicker.modeOpen,
      save: Components.interfaces.nsIFilePicker.modeSave,
      folder: Components.interfaces.nsIFilePicker.modeGetFolder,
    }[mode];

    fp.init(window, title, mode);

    for (const [label, ext] of filters || []) {
      fp.appendFilter(label, ext);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return new Promise((resolve) => {
      fp.open((userChoice) => {
        switch (userChoice) {
          case Components.interfaces.nsIFilePicker.returnOK:
          case Components.interfaces.nsIFilePicker.returnReplace:
            resolve(fp.file.path);
            break;

          default: // aka returnCancel
            resolve("");
            break;
        }
      });
    });
  }
  /**
   * Output to both Zotero.debug and console.log
   * @param data e.g. string, number, object, ...
   */
  log(...data: any) {
    if (data.length === 0) {
      return;
    }
    // If logOption is not provides, use the global one.
    if (data[data.length - 1]?._type !== "toolkitlog") {
      data.push(this.logOptionsGlobal);
    }
    return log(...data);
  }

  private _repatch(
    object: { [sign: string]: any },
    funcSign: string,
    ownerSign: string,
    patcher: (fn: Function) => Function
  ) {
    this.log("patching", funcSign);
    object[funcSign] = patcher(object[funcSign]);
    object[funcSign][ownerSign] = true;
  }

  /**
   * Patch a function
   * @param object The owner of the function
   * @param funcSign The signature of the function(function name)
   * @param ownerSign The signature of patch owner to avoid patching again
   * @param patcher The new wrapper of the patched funcion
   */
  patch(
    object: { [sign: string]: any },
    funcSign: string,
    ownerSign: string,
    patcher: (fn: Function) => Function
  ) {
    if (object[funcSign][ownerSign]) throw new Error(`${funcSign} re-patched`);
    this._repatch(object, funcSign, ownerSign, patcher);
  }

  /**
   * Get all extra fields
   * @param item
   */
  getExtraFields(item: Zotero.Item): Map<string, string> {
    return Zotero.Utilities.Internal.extractExtraFields(item.getField("extra"))
      .fields;
  }

  /**
   * Get extra field value by key. If it does not exists, return undefined.
   * @param item
   * @param key
   */
  getExtraField(item: Zotero.Item, key: string): string | undefined {
    const fields = this.getExtraFields(item);
    return fields.get(key);
  }

  /**
   * Replace extra field of an item.
   * @param item
   * @param fields
   */
  async replaceExtraFields(
    item: Zotero.Item,
    fields: Map<string, string>
  ): Promise<void> {
    let kvs = [];
    fields.forEach((v, k) => {
      kvs.push(`${k}: ${v}`);
    });
    item.setField("extra", kvs.join("\n"));
    await item.saveTx();
  }

  /**
   * Set an key-value pair to the item's extra field
   * @param item
   * @param key
   * @param value
   */
  async setExtraField(
    item: Zotero.Item,
    key: string,
    value: string
  ): Promise<void> {
    const fields = this.getExtraFields(item);
    fields.set(key, value);
    await this.replaceExtraFields(item, fields);
  }
}

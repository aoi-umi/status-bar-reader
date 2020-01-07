import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

let myStatusBarItem: vscode.StatusBarItem;

export function activate({ subscriptions }: vscode.ExtensionContext) {
	let reader = new Reader();
	const name = 'statusBarReader';
	const next = `${name}.next`;
	const prev = `${name}.prev`;
	const nextLine = `${name}.nextLine`;
	const prevLine = `${name}.prevLine`;
	const bookList = `${name}.bookList`;
	const toggle = `${name}.toggle`;
	const line = `${name}.line`;

	subscriptions.push(vscode.commands.registerCommand(next, () => {
		reader.next();
	}));
	subscriptions.push(vscode.commands.registerCommand(nextLine, () => {
		reader.next(true);
	}));
	subscriptions.push(vscode.commands.registerCommand(prev, () => {
		reader.prev();
	}));
	subscriptions.push(vscode.commands.registerCommand(prevLine, () => {
		reader.prev(true);
	}));
	subscriptions.push(vscode.commands.registerCommand(bookList, () => {
		reader.showBookList();
	}));
	subscriptions.push(vscode.commands.registerCommand(line, () => {
		reader.toLineClick();
	}));
	let show = true;
	subscriptions.push(vscode.commands.registerCommand(toggle, () => {
		show ? myStatusBarItem.hide() : myStatusBarItem.show();
		show = !show;
	}));
	// create a new status bar item that we can now manage
	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
	myStatusBarItem.command = bookList;
	subscriptions.push(myStatusBarItem);

	myStatusBarItem.show();
	reader.initEnv();
}

const BookStatus = {
	start: 0,
	reading: 1,
	end: 2
};
let bookDirPath = path.join(__dirname, '../book');
let saveDataDirPath = path.join(__dirname, '../saveData');
let saveDataPath = path.join(saveDataDirPath, './data.json');
let mkdirsSync = function (dirname, mode?) {
	if (fs.existsSync(dirname)) {
		return true;
	}
	if (mkdirsSync(path.dirname(dirname), mode)) {
		fs.mkdirSync(dirname, mode);
		return true;
	}
	return false;
}

type SaveData = {
	name: string;
	line: number;
	col: number;
};
class Reader {
	textLength = 20;
	rl: readline.Interface;
	lines: string[] = [];
	currLine = 0;
	currCol = 0;
	currText = '';
	bookStatus = BookStatus.start;

	saveDataList: SaveData[] = [];
	saveData: SaveData = {
		name: '',
		line: 0,
		col: 0,
	};

	async initEnv() {
		this.updateText('init env');
		mkdirsSync(saveDataDirPath);
		if (!fs.existsSync(saveDataPath)) {
			this.save();
		} else {
			let data = fs.readFileSync(saveDataPath, { encoding: 'utf-8' }).toString();
			if (data)
				this.saveDataList = JSON.parse(data);
		}
		this.updateText('click to open a book');
	}

	createSaveData() {
		return `${JSON.stringify(this.saveDataList, null, '\t')}`;
	}

	save() {
		fs.writeFileSync(saveDataPath, this.createSaveData());
	}

	getSaveDataByName(name: string) {
		let idx = this.saveDataList.findIndex(ele => ele.name === name);
		return {
			idx,
			saveData: this.saveDataList[idx],
		};
	}

	saveProgress() {
		if (this.currLine !== this.saveData.line
			|| this.currCol !== this.saveData.col) {
			let { idx } = this.getSaveDataByName(this.saveData.name);
			this.saveData.line = this.currLine;
			this.saveData.col = this.currCol;
			if (idx < 0) {
				this.saveDataList.unshift(this.saveData);
			} else {
				this.saveDataList.splice(idx, 1, this.saveData);
			}
			this.save();
		}
	}

	getBookList() {
		let files = fs.readdirSync(bookDirPath);
		return files;
	}

	initBook() {
		this.lines = [];
		this.initStatus();
	}

	initStatus() {
		this.currLine = 0;
		this.bookStatus = BookStatus.start;
		this.clear();
	}

	loadBook(file?) {
		this.updateText('init');
		this.initBook();
		if (!file) {
			let files = this.getBookList();
			file = files[0];
		}

		this.updateText('init finished');
		if (!file) {
			this.updateText('no book');
			return;
		}
		this.saveData.name =
			myStatusBarItem.tooltip = file;
		this.updateText('loading book');
		let readStream = fs.createReadStream(path.join(bookDirPath, file), {
			encoding: 'utf-8',
		});
		this.rl = readline.createInterface({
			input: readStream
		});
		this.rl.on('line', (chunk) => {
			this.lines.push(chunk);
		});
		this.rl.on('close', () => {
			let { saveData } = this.getSaveDataByName(this.saveData.name);
			if (saveData) {
				this.saveData = saveData;
				this.currLine = saveData.line;
				this.currCol = saveData.col;
			}
			this.next();
		});
	}

	updateText(text: string) {
		myStatusBarItem.text = text;
	}

	setText() {
		let text = this.lines[this.currLine];
		this.currText = text.substr(this.currCol, this.textLength);
		this.updateText(this.currText + `(${this.currLine + 1}/${this.lines.length})`);
		this.bookStatus = BookStatus.reading;
		this.saveProgress();
	}

	clear() {
		this.currCol = 0;
		this.currText = '';
	}

	next(line?: boolean) {
		if (this.bookStatus === BookStatus.end)
			return;
		let lastLine = this.currLine >= this.lines.length - 1;
		let text = this.lines[this.currLine];
		let lastChar = !text || this.currCol + this.currText.length >= text.length;

		if (lastLine && lastChar) {
			this.updateText('### book end ###');
			this.clear();
			this.bookStatus = BookStatus.end;
			return;
		}

		this.currCol = this.currCol + this.currText.length
		if (line || this.currCol + this.currText.length >= text.length) {
			if (this.bookStatus !== BookStatus.start)
				this.currLine++;
			this.clear();
		}
		this.setText();
	}

	prev(line?: boolean) {
		if (this.bookStatus === BookStatus.start)
			return;
		if (this.currLine === 0 && this.currCol === 0) {
			this.updateText('### book start ###');
			this.clear();
			this.bookStatus = BookStatus.start;
			return;
		}
		let text = this.lines[this.currLine];
		if (line || this.currCol === 0) {
			if (this.bookStatus !== BookStatus.end)
				this.currLine--;
			this.currCol = 0;
			text = this.lines[this.currLine];
			if (!line && text.length > this.textLength)
				this.currCol = text.length - this.textLength;
		} else {
			this.currCol = this.currCol - this.textLength;
			if (this.currCol < 0)
				this.currCol = 0;
		}
		this.setText();
	}

	async showBookList() {
		let list = this.getBookList();
		let selectd = await vscode.window.showQuickPick(list);
		selectd && this.loadBook(selectd);
	}

	async toLineClick() {
		if (!this.lines.length) {
			await vscode.window.showInformationMessage('please open a book');
			return;
		}
		let num = 0;
		await vscode.window.showInputBox({
			validateInput: (val) => {
				if (!/[0-9]+/.test(val))
					return 'please input a number';
				num = parseInt(val);
				if (num <= 0 || num > this.lines.length)
					return 'out of range';
			}
		});
		if (num) {
			this.goto(num);
		}
	}

	goto(line: number, col?: number) {
		this.initStatus();
		this.currLine = line - 1;
		if (col)
			this.currCol = col;
		this.next();
	}
}

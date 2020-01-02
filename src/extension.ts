import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

let myStatusBarItem: vscode.StatusBarItem;

export function activate({ subscriptions }: vscode.ExtensionContext) {

	// register a command that is invoked when the status bar
	// item is selected
	const nextLine = 'extension.helloWorld';
	// subscriptions.push(vscode.commands.registerCommand(myCommandId, () => {
	// 	let n = getNumberOfSelectedLines(vscode.window.activeTextEditor);
	// 	vscode.window.showInformationMessage(`Yeah, ${n} line(s) selected... Keep going!`);
	// }));

	let disposable = vscode.commands.registerCommand(nextLine, () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		Reader.nextLine();
	});
	subscriptions.push(disposable);

	// create a new status bar item that we can now manage
	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
	myStatusBarItem.command = nextLine;
	subscriptions.push(myStatusBarItem);

	// register some listener that make sure the status bar 
	// item always up-to-date
	// subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem));
	// subscriptions.push(vscode.window.onDidChangeTextEditorSelection(updateStatusBarItem));

	myStatusBarItem.show();
	Reader.init();
}

class Reader {
	static textLength = 20;
	static rl: readline.Interface;
	static lines: string[] = [];
	static currLine = 0;
	static resume = true;
	static idx = 0;
	static currText = '';
	static init() {
		Reader.updateText('init');
		let dirPath = path.join(__dirname, '../book');
		let files = fs.readdirSync(dirPath);
		let file = files[0];

		Reader.updateText('init finished');
		if (!file) {
			Reader.updateText(!file ? 'no book' : 'loading book');
			return;
		}
		Reader.updateText('loading book');
		let readStream = fs.createReadStream(path.join(dirPath, file), {
			encoding: 'utf-8',
		});
		const rl = this.rl = readline.createInterface({
			input: readStream
		});
		rl.on('line', (chunk) => {
			this.handleLine(chunk);
		});
	}

	static updateText(text: string) {
		myStatusBarItem.text = text;
	}

	static handleLine(line: string) {
		this.rl.pause();
		this.lines.push(line);
		if (this.resume) {
			this.nextLine();
			this.resume = false;
		}
	}

	static nextLine() {
		if (!this.rl)
			return
		let lastLine = this.currLine >= this.lines.length - 1;
		let text = this.lines[this.currLine];
		let lastChar = !text || this.idx + this.currText.length >= text.length;

		if (lastLine && lastChar) {
			if ((this.rl as any).closed) {
				this.updateText('### finished ###');
				return;
			}

			this.resume = true;
			this.rl.resume();
			return;
		}
		this.currText = text.substr(this.idx, this.textLength);
		this.updateText(this.currText);
		if (this.idx + this.currText.length >= text.length) {
			this.currLine++;
			this.idx = 0;
			this.currText = '';
		} else
			this.idx = this.idx + this.currText.length;
	}
}

import * as core from '@actions/core';
import * as dotenv from 'dotenv';
import { TranslationStatus } from '@crowdin/crowdin-api-client';
import fs from 'fs';

dotenv.config();

async function run(): Promise<void> {
    try {
        checkEnvironmentVariables();
        let languages = await getLanguagesProgress();
        let markdown = generateMarkdown(languages);
        writeReadme(markdown);
        core.info('Done !');
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message);
    }
}

function checkEnvironmentVariables(): void {
    core.info('Checking environment variables...');

    let token = process.env.CROWDIN_PERSONAL_TOKEN;
    if (!token) {
        throw Error('Missing environment variable: CROWDIN_PERSONAL_TOKEN');
    }

    let projectId = process.env.CROWDIN_PROJECT_ID;
    if (!projectId) {
        throw Error('Missing environment variable: CROWDIN_PROJECT_ID');
    }

    let baseUrl = process.env.CROWDIN_BASE_URL;
    if (!baseUrl) {
        throw Error('Missing environment variable: CROWDIN_BASE_URL');
    }
}

function getLanguagesProgress() {
    core.info('Retrieving translations progress from Crowdin...');

    const translationStatusApi = new TranslationStatus({
        baseUrl: String(process.env.CROWDIN_BASE_URL),
        token: String(process.env.CROWDIN_PERSONAL_TOKEN),
    });

    return translationStatusApi
        .withFetchAll()
        .getProjectProgress(Number(process.env.CROWDIN_PROJECT_ID))
        .then((response) => {
            let languages: any[] = [];

            response.data.forEach(function (language) {
                languages.push(language.data);
                core.info(language.data.languageId + ' progress is ' + language.data.translationProgress);
            })

            languages.sort((a, b) => (a.translationProgress < b.translationProgress) ? 1 : -1)

            return languages;
        })
        .catch(error => {
            console.error('translationStatusApi : ');
            console.error(error);
        });
}

function generateMarkdown(languages: any[] | void): string {
    core.info('Generate Markdown table...');

    let markdown: string = ``;
    let minimumCompletionPercent: number = +core.getInput('minimum_completion_percent');
    markdown += generateTableSection(languages?.filter(language => language.translationProgress >= minimumCompletionPercent), 'Available');
    markdown += generateTableSection(languages?.filter(language => language.translationProgress < minimumCompletionPercent), 'In progress');

    return markdown;
}

function generateTableSection(languages: any[] | void, title: string): string {
    if (!languages || languages.length == 0) {
        return '';
    }

    const count: number = languages ? languages.length : 0;
    let languagesPerRow: number = +core.getInput('languages_per_row');
    languagesPerRow = count < languagesPerRow ? count : languagesPerRow;

    let markdown: string = '\n\n';
    markdown += `#### ${title}`;
    markdown += '\n\n';
    markdown += `<table>`;

    languages.forEach(function (language, index: number) {
        const currentIndex: number = index + 1;
        if (currentIndex % languagesPerRow == 1 || currentIndex == 1) {
            markdown += '<tr>';
        }

        markdown += `<td align="center" valign="top"><img width="30px" height="30px" src="https://raw.githubusercontent.com/benjaminjonard/crowdin-translations-progress-action/1.0/flags/${language.languageId}.png"></div><div align="center" valign="top">${language.translationProgress}%</td>`;

        if (currentIndex % languagesPerRow == 0) {
            markdown += '</tr>';
        }
    });

    markdown += `</table>`;

    return markdown;
}

function writeReadme(markdown: string): void {
    let file: string = core.getInput('file');

    if (!fs.existsSync(file)) {
        throw Error(`The file ${file} doesn't exists`);
    }

    core.info(`Writing to file ${file} with content ${markdown}`);

    let fileContents = fs.readFileSync(file).toString();

    markdown = `<!-- CROWDIN-TRANSLATIONS-PROGRESS-ACTION-START -->\n${markdown}\n<!-- CROWDIN-TRANSLATIONS-PROGRESS-ACTION-END -->`
    fileContents = fileContents.replace(/<!-- CROWDIN-TRANSLATIONS-PROGRESS-ACTION-START -->.*<!-- CROWDIN-TRANSLATIONS-PROGRESS-ACTION-END -->/gs, markdown);

    fs.writeFileSync(file, fileContents);
}

/*function getFlagEmoji(countryCode: string) {
    const codePoints = countryCode
        .toUpperCase()
        .slice(0, 2)
        .split('')
        .map(char =>  127397 + char.charCodeAt(0));

    return String.fromCodePoint(...codePoints);
}*/

run();

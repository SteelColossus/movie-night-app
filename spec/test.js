'use strict';

const { Builder, Browser, By, Key, until } = require('selenium-webdriver');
const { spawn } = require('child_process');

let driver = null;
let appProcess = null;

async function getVisibleElement(locator, timeout = 500) {
    const element = await driver.wait(until.elementLocated(locator), timeout);
    await driver.wait(until.elementIsVisible(element), timeout);
    return element;
}

beforeEach(async (done) => {
    appProcess = spawn('node', ['.', '--no-password', '--live']);

    driver = new Builder().forBrowser(Browser.CHROME).build();
    await driver.get('http://localhost:3000');
    await driver.wait(until.titleIs('Movie Night App'), 1000);
    done();
});

afterEach(async (done) => {
    await driver.quit();
    appProcess.kill();
    done();
});

// This test should not be guaranteed to pass, it is just an indication of whether any functionality is broken
describe('integration test', () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;

    it('creates and finishes a movie night', async () => {
        const username = await getVisibleElement(By.id('username'));
        await username.sendKeys('User 1', Key.ENTER);

        const usernameIndicator = await (await getVisibleElement(By.id('usernameIndicator'))).getText();
        expect(usernameIndicator).toBe('User 1', 'Username indicator is not displaying the correct text.');
        await (await getVisibleElement(By.css('#votingSystem > option[value="Multi Vote"]'))).click();
        await (await getVisibleElement(By.css('#numSuggestions > option[value="1"]'))).click();
        const nightName = await getVisibleElement(By.id('nightName'));
        await nightName.sendKeys('My Movie Night', Key.ENTER);

        const movieNightTitle = await (await getVisibleElement(By.id('movieNightTitle'))).getText();
        expect(movieNightTitle).toBe('My Movie Night', 'Movie night title is not displaying the correct text.');
        const suggestion = await getVisibleElement(By.id('suggestion'));
        await suggestion.sendKeys('Harry Potter', Key.ENTER);
        const movieToSelect = await getVisibleElement(
            By.xpath('//table[@id="suggestionTable"]//tr[./td[text() = "Harry Potter and the Goblet of Fire"]]'),
            3000
        );
        await movieToSelect.findElement(By.xpath('./td[text() = "2005"]'));
        const chooseButton = await movieToSelect.findElement(By.xpath('./td/input[@type="button"]'));
        await chooseButton.click();

        await getVisibleElement(By.xpath('//table[@id="movieTable"]//tr/td[text() = "2 hours 37 mins"]'));
        await (await getVisibleElement(By.id('closeSuggestionsButton'))).click();

        const voteButton = await getVisibleElement(By.css('table#voteTable td > input[type="button"][value="Vote!"]'));
        const voteText = await driver.findElement(By.css('table#voteTable td[votes-for]'));
        async function checkVoting(val) {
            await voteButton.click();
            await driver.sleep(500);
            expect(await voteText.getText()).toBe(val, 'Movie does not have the correct number of votes.');
        }
        await checkVoting('1');
        await checkVoting('0');
        await checkVoting('1');
        await (await driver.findElement(By.id('closeVotingButton'))).click();

        const winnerText = await (await getVisibleElement(By.id('winner'))).getText();
        expect(winnerText).toContain('Harry Potter and the Goblet of Fire', 'The winner is incorrectly displayed.');
        await getVisibleElement(By.id('voteChart'), 1000);
        await (await driver.findElement(By.id('endButton'))).click();

        await (await getVisibleElement(By.id('nightName')));
        await driver.sleep(500);
        const movieNightTitle2 = await driver.findElement((By.id('movieNightTitle')));
        expect(await movieNightTitle2.isDisplayed()).toBeFalsy('Movie night title is displaying when it shouldn\'t be.');
    });
});
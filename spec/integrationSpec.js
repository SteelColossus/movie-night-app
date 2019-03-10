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
    appProcess = spawn('node', ['.']);

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

describe('integration test', () => {
    it('creates and finishes a movie night', async (done) => {
        const username = await getVisibleElement(By.id('username'));
        await username.sendKeys('User 1', Key.ENTER);

        const usernameIndicator = await (await getVisibleElement(By.id('usernameIndicator'))).getText();
        expect(usernameIndicator).toBe('User 1', 'Username indicator is not displaying the correct text.');
        const votingSystem = await getVisibleElement(By.id('votingSystem'));
        await votingSystem.click();
        await (await getVisibleElement(By.css('option[value="Multi Vote"]'))).click();
        const nightName = await getVisibleElement(By.id('nightName'));
        await nightName.sendKeys('My Movie Night', Key.ENTER);

        const movieNightTitle = await (await getVisibleElement(By.id('movieNightTitle'))).getText();
        expect(movieNightTitle).toBe('My Movie Night', 'Movie night title is not displaying the correct text.');
        const suggestion = await getVisibleElement(By.id('suggestion'));
        await suggestion.sendKeys('Harry Potter', Key.ENTER);
        const movieToSelect = await getVisibleElement(By.xpath('//tr[./td[text() = \'Harry Potter and the Goblet of Fire\']]'), 1000);
        await movieToSelect.findElement(By.xpath('./td[text() = \'2005\']'));
        const chooseButton = await movieToSelect.findElement(By.xpath('./td/input[@type="button"]'));
        await driver.wait(async () => {
            await chooseButton.click();
            return (await chooseButton.getAttribute('class')).includes('active');
        }, 500);

        await getVisibleElement(By.xpath('//tr/td[text() = \'157 min\']'));
        await (await getVisibleElement(By.id('closeSuggestionsButton'))).click();

        const voteButton = await getVisibleElement(By.xpath('//td/input[@type="button" and contains(@value, "Vote")]'));
        const voteText = await driver.findElement(By.xpath('//td[@votes-for]'));
        const checkVoting = async (val) => {
            await voteButton.click();
            await driver.sleep(500);
            expect(await voteText.getText()).toBe(val, 'Movie does not have the correct number of votes.');
        };
        await checkVoting('1');
        await checkVoting('0');
        await checkVoting('1');
        await (await driver.findElement(By.id('closeVotingButton'))).click();

        const winnerText = await (await getVisibleElement(By.id('winner'))).getText();
        expect(winnerText).toContain('Harry Potter and the Goblet of Fire', 'The winner is incorrectly displayed.');
        expect(winnerText).toContain('1', 'The winner is incorrectly displayed.');
        await getVisibleElement(By.id('voteChart'), 1000);
        await (await driver.findElement(By.id('endButton'))).click();

        await (await getVisibleElement(By.id('nightName')));
        await driver.sleep(500);
        const movieNightTitle2 = await driver.findElement((By.id('movieNightTitle')));
        expect(await movieNightTitle2.isDisplayed()).toBeFalsy('Movie night title is displaying when it shouldn\'t be.');
        done();
    }, 15000);
});
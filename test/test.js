const { Builder, Browser, By, Key, until } = require('selenium-webdriver');

const driver = new Builder().forBrowser(Browser.CHROME).build();

async function getVisibleElement(locator, timeout = 500) {
    const element = await driver.wait(until.elementLocated(locator), timeout);
    await driver.wait(until.elementIsVisible(element), timeout);
    return element;
}

function assert(condition, errorText) {
    if (!condition) {
        throw new Error(errorText);
    }
}

(async () => {
    try {
        await driver.get('http://localhost:3000');
        await driver.wait(until.titleIs('Movie Night App'), 1000);

        const username = await getVisibleElement(By.id('username'));
        await username.sendKeys('User 1', Key.ENTER);

        const usernameIndicator = await (await getVisibleElement(By.id('usernameIndicator'))).getText();
        assert(usernameIndicator === 'User 1', 'Username indicator is not displaying the correct text.');
        const votingSystem = await getVisibleElement(By.id('votingSystem'));
        await votingSystem.click();
        await (await getVisibleElement(By.css('option[value="Multi Vote"]'))).click();
        const nightName = await getVisibleElement(By.id('nightName'));
        await nightName.sendKeys('My Movie Night', Key.ENTER);

        const movieNightTitle = await (await getVisibleElement(By.id('movieNightTitle'))).getText();
        assert(movieNightTitle === 'My Movie Night', 'Movie night title is not displaying the correct text.');
        const suggestion = await getVisibleElement(By.id('suggestion'));
        await suggestion.sendKeys('Harry Potter', Key.ENTER);
        const movieToSelect = await getVisibleElement(By.xpath('//tr[./td[text() = \'Harry Potter and the Goblet of Fire\']]'));
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
            assert(await voteText.getText() === val, 'Movie does not have the correct number of votes.');
        };
        await checkVoting('1');
        await checkVoting('0');
        await checkVoting('1');
        await (await driver.findElement(By.id('closeVotingButton'))).click();

        const winnerText = await (await getVisibleElement(By.id('winner'))).getText();
        assert(winnerText.includes('Harry Potter and the Goblet of Fire') && winnerText.includes('1'), 'The winner is incorrectly displayed.');
        await getVisibleElement(By.id('voteChart'), 1000);
        await (await driver.findElement(By.id('endButton'))).click();

        await (await getVisibleElement(By.id('nightName')));
        await driver.sleep(500);
        const movieNightTitle2 = await driver.findElement((By.id('movieNightTitle')));
        assert(!(await movieNightTitle2.isDisplayed()), 'Movie night title is displaying when it shouldn\'t be.');

        console.log('Test passed!');
    }
    catch (e) {
        console.log('Test failed!');
        console.log(e);
    }
    finally {
        await driver.quit();
    }
})();
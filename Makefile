.PHONY: run setup phantomjs meteor

run: setup searcher meteor viewer1 viewer2 viewer3 viewer4

setup:
	meteor-npm

searcher:
	phantomjs --webdriver=9134
viewer1:
	phantomjs --webdriver=9135
viewer2:
	phantomjs --webdriver=9136
viewer3:
	phantomjs --webdriver=9137
viewer4:
	phantomjs --webdriver=9138

meteor:
	meteor

clean:
	rm -rf packages .meteor/local

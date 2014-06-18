.PHONY: run setup phantomjs meteor

run: setup searcher meteor viewer1 viewer2 viewer3 viewer4

setup:
	mkdir -p storage/searcher storage/viewer1 storage/viewer2 storage/viewer3 storage/viewer4
	meteor-npm

# FIXME: local storage path is ignored. See https://github.com/ariya/phantomjs/issues/11596
# Use docker or some other virtual machine to work around this.
searcher:
	phantomjs --webdriver=9134 --cookies-file=storage/searcher.cookie --local-storage-path=storage/searcher
viewer1:
	phantomjs --webdriver=9135 --cookies-file=storage/viewer1.cookie --local-storage-path=storage/viewer1
viewer2:
	phantomjs --webdriver=9136 --cookies-file=storage/viewer2.cookie --local-storage-path=storage/viewer2
viewer3:
	phantomjs --webdriver=9137 --cookies-file=storage/viewer3.cookie --local-storage-path=storage/viewer3
viewer4:
	phantomjs --webdriver=9138 --cookies-file=storage/viewer4.cookie --local-storage-path=storage/viewer4

meteor:
	meteor

clean:
	rm -rf packages .meteor/local storage

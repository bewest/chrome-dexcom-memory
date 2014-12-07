
BROWSERIFY=./node_modules/.bin/browserify

clean:
	rm -Rf build
	mkdir build

build:
	# hi
	mkdir -p build/js build/css build/html build/images
	${BROWSERIFY} -r dexcom-uart -r serial-chromeify -o build/js/dexcom.js
	${BROWSERIFY} -r browserify-jquery:jquery  > build/js/jquery.js
	${BROWSERIFY} -r adm-zip  > build/js/adm-zip.js
	${BROWSERIFY} -r buffer  > build/js/buffer.js
	${BROWSERIFY} -r browser-filesaver  > build/js/filesaver.js
	${BROWSERIFY} -r zip-stream  > build/js/zip-stream.js
	${BROWSERIFY} ./src/js/background.js -o build/js/background.js
	# ${BROWSERIFY} -r content:./src/js/content.js -o build/js/content.js
	${BROWSERIFY} -x jquery ./src/js/app.js -o build/js/app.js
	cp src/manifest.json build/manifest.json
	cp src/html/* build/html/
	cp src/css/* build/css/
	cp bower_components/solarized/css/solarized.css build/css/
	cp src/images/* build/images/

.PHONY: build

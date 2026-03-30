UUID         = chakra-switch@narkagni
INSTALL_PATH = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SCHEMAS_DIR  = schemas

all: install

build-schemas:
	glib-compile-schemas $(SCHEMAS_DIR)

install: build-schemas
	rm -rf $(INSTALL_PATH)
	mkdir -p $(INSTALL_PATH)
	mkdir -p $(INSTALL_PATH)/src
	cp extension.js   $(INSTALL_PATH)/
	cp prefs.js       $(INSTALL_PATH)/
	cp stylesheet.css $(INSTALL_PATH)/
	cp metadata.json  $(INSTALL_PATH)/
	cp -r schemas/    $(INSTALL_PATH)/schemas/
	cp src/*.js       $(INSTALL_PATH)/src/
	@echo "Chakra Switch installed. Restart GNOME Shell to apply."

pack: build-schemas
	zip -r $(UUID).zip . \
		-x "*.git*" \
		-x "Makefile" \
		-x "README.md" \
		-x "_gitignore" \
		-x "media/*" \
		-x "*.zip"

uninstall:
	rm -rf $(INSTALL_PATH)
	@echo "Chakra Switch uninstalled."

clean:
	rm -f $(SCHEMAS_DIR)/gschemas.compiled
	rm -f *.zip